import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { handle, ok, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { Dispute } from "@/lib/models";
import { buildDisputeTimelineEntry } from "@/lib/models/Dispute";
import { saveUpload } from "@/lib/services/files";
import { notify } from "@/lib/services/notify";
import { disputeInboxLink } from "@/lib/services/disputes";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

async function loadCase(id: string, session: { sub: string; role: string }) {
  const dispute = await Dispute.findById(id);
  if (!dispute) throw new ApiError("Case not found", 404);
  const isAdmin = session.role === "admin";
  const isParty =
    dispute.raisedBy.toString() === session.sub || dispute.againstUserId.toString() === session.sub;
  if (!isAdmin && !isParty) throw new ApiError("Not authorized", 403);
  return dispute;
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);

    const dispute = await loadCase(id, session);
    const isAdmin = session.role === "admin";
    const messages = (dispute.messages || []).filter((m) => isAdmin || !m.internal);

    return ok({
      messages,
      lastMessageAt: dispute.lastMessageAt,
      viewer: { role: session.role, id: session.sub },
    });
  });
}

/**
 * Add to the case conversation. Admins may post either a reply visible to both
 * parties or an internal investigation note that only admins can read.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);

    const dispute = await loadCase(id, session);
    const isAdmin = session.role === "admin";

    if (["closed"].includes(dispute.status)) {
      throw new ApiError("This case is closed", 409);
    }

    const contentType = req.headers.get("content-type") || "";
    let body = "";
    let internal = false;
    const files: File[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      body = String(form.get("body") || "").trim();
      internal = String(form.get("internal") || "") === "true";
      for (const entry of form.getAll("evidence")) {
        if (entry instanceof File && entry.size > 0) files.push(entry);
      }
    } else {
      const payload = await readJson<{ body?: string; internal?: boolean }>(req);
      body = (payload.body || "").trim();
      internal = payload.internal === true;
    }

    if (internal && !isAdmin) throw new ApiError("Only admins can add internal notes", 403);
    if (!body && files.length === 0) throw new ApiError("Write a message or attach a file", 400);
    if (body.length > 4000) throw new ApiError("Message is too long (max 4000 characters)", 400);

    const fileIds: string[] = [];
    for (const file of files) {
      const asset = await saveUpload(file, session.sub, "dispute_evidence");
      asset.entityId = dispute._id;
      await asset.save();
      fileIds.push(asset._id.toString());
    }

    const now = new Date();
    dispute.messages.push({
      at: now,
      authorId: new mongoose.Types.ObjectId(session.sub),
      authorRole: session.role,
      body: body.slice(0, 4000),
      fileIds,
      internal,
    } as never);
    dispute.lastMessageAt = now;
    if (fileIds.length) {
      dispute.evidenceFileIds.push(...fileIds.map((fid) => new mongoose.Types.ObjectId(fid)));
    }
    if (isAdmin && !dispute.firstResponseAt) dispute.firstResponseAt = now;
    if (!internal) {
      dispute.timeline.push(
        buildDisputeTimelineEntry(isAdmin ? "admin_replied" : "party_replied", {
          actorId: new mongoose.Types.ObjectId(session.sub),
          actorRole: session.role,
          note: body.slice(0, 140),
        }) as never
      );
    } else {
      dispute.timeline.push(
        buildDisputeTimelineEntry("internal_note_added", {
          actorId: new mongoose.Types.ObjectId(session.sub),
          actorRole: session.role,
          note: body.slice(0, 140),
        }) as never
      );
    }
    await dispute.save();

    if (!internal) {
      const recipient = dispute.raisedBy.toString() === session.sub ? dispute.againstUserId : dispute.raisedBy;
      const link = await disputeInboxLink(recipient, dispute._id);
      await notify(recipient, {
        type: "dispute_message",
        title: isAdmin ? "Support replied to your case" : "New message on your case",
        body: `${dispute.code}: ${body.slice(0, 120)}`,
        link,
        category: "booking",
      });
    }

    await logAudit(
      session,
      internal ? "dispute_internal_note" : "dispute_message",
      `Message added to ${dispute.code}`,
      { entity: "Dispute", entityId: dispute._id.toString() }
    );

    return ok({
      message: {
        at: now,
        authorId: session.sub,
        authorRole: session.role,
        body: body.slice(0, 4000),
        fileIds,
        internal,
      },
      lastMessageAt: dispute.lastMessageAt,
    });
  });
}
