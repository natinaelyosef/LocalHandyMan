import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Booking, Dispute } from "@/lib/models";
import { handle, ok, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import {
  DISPUTE_OUTCOMES,
  DISPUTE_PRIORITIES,
  DISPUTE_STATUSES,
  canDisputeTransition,
} from "@/lib/constants";
import { buildDisputeTimelineEntry } from "@/lib/models/Dispute";
import { notify } from "@/lib/services/notify";
import { counterpartOf, disputeInboxLink } from "@/lib/services/disputes";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

type Viewer = { role: string; sub: string };

/**
 * Loads a dispute and asserts the viewer is allowed to see it. Internal
 * investigation notes are stripped for non-admins.
 */
async function loadDisputeForViewer(id: string, viewer: Viewer) {
  await connectDB();
  const dispute = await Dispute.findById(id)
    .populate("raisedBy", "name phone email avatarFileId role")
    .populate("againstUserId", "name phone email avatarFileId role")
    .populate("assignedTo", "name email role")
    .populate("bookingId", "code title status agreedTotal startDate createdAt location")
    .lean();
  if (!dispute) throw new ApiError("Case not found", 404);

  const isAdmin = viewer.role === "admin";
  const isParty =
    (dispute.raisedBy as unknown as { _id: mongoose.Types.ObjectId })._id.toString() === viewer.sub ||
    (dispute.againstUserId as unknown as { _id: mongoose.Types.ObjectId })._id.toString() === viewer.sub;
  if (!isAdmin && !isParty) throw new ApiError("Not authorized", 403);

  // Internal investigation notes are admin-only; filter rather than mutate the
  // lean document so the inferred type stays intact.
  const messages = (dispute.messages || []).filter((m) => isAdmin || !m.internal);

  return { dispute, messages, isAdmin, isParty };
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);

    const { dispute, messages, isAdmin, isParty } = await loadDisputeForViewer(id, session);

    const siblings = await Dispute.find({ bookingId: dispute.bookingId })
      .select("code status createdAt")
      .sort({ createdAt: -1 })
      .lean();

    return ok({
      dispute,
      messages,
      siblings,
      viewer: { role: session.role, id: session.sub, isAdmin, isParty },
      allowedTransitions: (DISPUTE_STATUSES as readonly string[]).filter((s) =>
        canDisputeTransition(dispute.status as never, s as never)
      ),
      outcomes: [...DISPUTE_OUTCOMES],
      priorities: [...DISPUTE_PRIORITIES],
    });
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);

    const body = await readJson<{
      action?: string;
      status?: string;
      priority?: string;
      assignedToId?: string | null;
      outcome?: string;
      refundAmount?: number;
      resolutionNotes?: string;
      note?: string;
    }>(req);

    await connectDB();
    const dispute = await Dispute.findById(id);
    if (!dispute) throw new ApiError("Case not found", 404);

    const isAdmin = session.role === "admin";
    const isParty =
      dispute.raisedBy.toString() === session.sub || dispute.againstUserId.toString() === session.sub;
    if (!isAdmin && !isParty) throw new ApiError("Not authorized", 403);

    const actor = new mongoose.Types.ObjectId(session.sub);
    const note = (body.note || "").slice(0, 2000);

    const pushTimeline = (
      action: string,
      opts: { note?: string; from?: string; to?: string } = {}
    ) => {
      dispute.timeline.push(
        buildDisputeTimelineEntry(action, {
          actorId: actor,
          actorRole: session.role,
          note: opts.note ?? "",
          from: opts.from ?? "",
          to: opts.to ?? "",
        }) as never
      );
    };

    const notifyCounterpart = async (title: string, text: string) => {
      const recipient = counterpartOf(dispute, session.sub);
      const link = await disputeInboxLink(recipient, dispute._id);
      await notify(recipient, {
        type: "dispute_updated",
        title,
        body: `${dispute.code}: ${text}`,
        link,
        category: "booking",
      });
    };

    switch (body.action) {
      case "assign": {
        if (!isAdmin) throw new ApiError("Only admins can assign cases", 403);
        const raw = body.assignedToId;
        // "me" self-assigns; null/"" unassigns; otherwise an explicit user id.
        const next = raw === "me" ? session.sub : raw ? String(raw) : null;
        if (next && !mongoose.Types.ObjectId.isValid(next)) throw new ApiError("Invalid assignee", 400);
        const prev = dispute.assignedTo ? dispute.assignedTo.toString() : "";
        dispute.assignedTo = next as never;
        pushTimeline("dispute_assigned", { from: prev, to: next ?? "", note });
        break;
      }

      case "priority": {
        if (!isAdmin) throw new ApiError("Only admins can change priority", 403);
        const priority = String(body.priority || "");
        if (!DISPUTE_PRIORITIES.includes(priority as never)) throw new ApiError("Invalid priority", 400);
        const prev = dispute.priority;
        dispute.priority = priority as never;
        pushTimeline("dispute_priority_changed", { from: prev, to: priority, note });
        break;
      }

      case "status": {
        const to = String(body.status || "");
        if (!DISPUTE_STATUSES.includes(to as never)) throw new ApiError("Invalid status", 400);
        if (to === "resolved" || to === "rejected") {
          if (!isAdmin) throw new ApiError("Only admins can resolve or reject a case", 403);
        }
        if (!canDisputeTransition(dispute.status as never, to as never)) {
          throw new ApiError(`Cannot move case from ${dispute.status} to ${to}`, 409);
        }
        const from = dispute.status;
        dispute.status = to as never;
        if (to === "closed") dispute.closedAt = new Date();
        if (!dispute.firstResponseAt && isAdmin) dispute.firstResponseAt = new Date();
        pushTimeline("dispute_status_changed", { from, to, note });
        await notifyCounterpart("Case status updated", `status is now ${to}`);
        break;
      }

      case "resolve": {
        if (!isAdmin) throw new ApiError("Only admins can resolve a case", 403);
        const outcome = String(body.outcome || "");
        if (!DISPUTE_OUTCOMES.includes(outcome as never)) throw new ApiError("Invalid resolution outcome", 400);
        const from = dispute.status;
        dispute.resolution = {
          outcome: outcome as never,
          refundAmount: Math.max(0, Number(body.refundAmount || 0)),
          notes: (body.resolutionNotes || "").slice(0, 2000),
          resolvedBy: actor,
          resolvedAt: new Date(),
        };
        dispute.status = "resolved" as never;
        if (!dispute.firstResponseAt) dispute.firstResponseAt = new Date();
        pushTimeline("dispute_resolved", {
          from,
          to: "resolved",
          note: `${outcome}${note ? ` — ${note}` : ""}`,
        });
        await notifyCounterpart("Your case was resolved", outcome);
        break;
      }

      case "close": {
        if (!isAdmin && !isParty) throw new ApiError("Not authorized", 403);
        if (!["resolved", "rejected"].includes(dispute.status)) {
          throw new ApiError("Only a resolved or rejected case can be closed", 409);
        }
        const from = dispute.status;
        dispute.status = "closed" as never;
        dispute.closedAt = new Date();
        pushTimeline("dispute_closed", { from, to: "closed", note });
        break;
      }

      default:
        throw new ApiError("Unknown action", 400);
    }

    await dispute.save();

    const booking = await Booking.findById(dispute.bookingId);
    if (booking) {
      const stillOpen = await Dispute.exists({
        _id: { $ne: dispute._id },
        bookingId: dispute.bookingId,
        status: { $in: ["open", "under_review", "awaiting_response"] },
      });
      if (!stillOpen) booking.disputeOpen = false;
      await booking.save();
    }

    await logAudit(session, `dispute_${body.action}`, `Dispute ${dispute.code}: ${body.action}`, {
      entity: "Dispute",
      entityId: dispute._id.toString(),
      meta: { status: dispute.status, priority: dispute.priority },
    });

    return ok({ dispute });
  });
}
