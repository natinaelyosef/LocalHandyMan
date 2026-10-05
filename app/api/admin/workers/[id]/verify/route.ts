import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { WorkerProfile, User } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notify";

const ACTIONS = ["approve", "reject", "request_resubmit", "suspend", "reactivate", "feature", "unfeature", "review_document"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ action?: string; note?: string; documentId?: string; docStatus?: string; featured?: boolean }>(req);
    if (!body.action || !ACTIONS.includes(body.action)) throw new ApiError("Invalid action", 400);

    await connectDB();
    const profile = await WorkerProfile.findById(id);
    if (!profile) return fail("Worker not found", 404);
    const user = await User.findById(profile.userId);
    if (!user) return fail("User not found", 404);

    if (body.action === "review_document") {
      if (!body.documentId || !["approved", "rejected"].includes(body.docStatus || "")) {
        throw new ApiError("documentId and docStatus (approved/rejected) are required", 400);
      }
      const doc = (profile.documents || []).find((d) => d._id.toString() === body.documentId);
      if (!doc) return fail("Document not found", 404);
      doc.status = body.docStatus as never;
      doc.reviewNote = body.note || "";
      doc.reviewedAt = new Date();
      await profile.save();
      await logAudit(session, "worker_document_reviewed", `Document "${doc.title}" ${body.docStatus} for ${user.email}`, {
        entity: "WorkerProfile",
        entityId: id,
      });
      return ok({ documents: profile.documents });
    }

    if (body.action === "approve") {
      profile.status = "approved";
      profile.statusNote = body.note || "";
      profile.verifiedAt = new Date();
      profile.verifiedBy = new mongoose.Types.ObjectId(session.sub);
      await user.save();
      await notify(profile.userId, {
        type: "worker_verified",
        title: "✓ Verified Worker",
        body: "Your profile has been approved. You can now receive jobs and submit quotations.",
        link: "/dashboard/worker",
        category: "worker",
      });
    }
    if (body.action === "reject") {
      if (!body.note) throw new ApiError("A rejection reason is required", 400);
      profile.status = "rejected";
      profile.statusNote = body.note;
      await notify(profile.userId, {
        type: "worker_rejected",
        title: "Profile not approved",
        body: `Reason: ${body.note}`,
        link: "/dashboard/worker/profile",
        category: "worker",
      });
    }
    if (body.action === "request_resubmit") {
      profile.status = "resubmit_required";
      profile.statusNote = body.note || "Please resubmit your documents.";
      await notify(profile.userId, {
        type: "worker_resubmit",
        title: "Documents need resubmission",
        body: body.note || "Please upload clearer documents.",
        link: "/dashboard/worker/profile",
        category: "worker",
      });
    }
    if (body.action === "suspend") {
      profile.status = "suspended";
      profile.statusNote = body.note || "Suspended by admin";
      user.status = "suspended";
      await user.save();
    }
    if (body.action === "reactivate") {
      profile.status = "pending";
      profile.statusNote = "";
      user.status = "active";
      await user.save();
    }
    if (body.action === "feature" || body.action === "unfeature") {
      profile.featured = body.action === "feature";
    }

    await profile.save();
    await logAudit(session, `worker_${body.action}`, `Worker ${user.email}: ${body.action}${body.note ? ` (${body.note})` : ""}`, {
      entity: "WorkerProfile",
      entityId: id,
      meta: { note: body.note || "" },
    });

    return ok({ profile });
  });
}
