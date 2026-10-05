import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Review } from "@/lib/models";
import { handle, ok, requireValidId, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const p = req.nextUrl.searchParams;
    const workerId = p.get("workerId");
    const customerId = p.get("customerId");
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Number(p.get("limit") || 20));
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (workerId === "me") {
      const session = await requireAuth(["worker"]);
      filter.workerId = session.sub;
      filter.status = { $ne: "removed" };
    } else if (customerId === "me") {
      const session = await requireAuth(["customer"]);
      filter.customerId = session.sub;
      filter.status = { $ne: "removed" };
    } else {
      filter.status = "visible";
      if (workerId) {
        requireValidId(workerId);
        filter.workerId = workerId;
      }
      if (customerId) {
        requireValidId(customerId);
        filter.customerId = customerId;
      }
    }

    const [items, total] = await Promise.all([
      Review.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customerId", "name avatarFileId")
        .populate("workerId", "name")
        .lean(),
      Review.countDocuments(filter),
    ]);

    const aggr = await Review.aggregate([
      { $match: { status: "visible", ...(workerId && workerId !== "me" ? { workerId: new mongoose.Types.ObjectId(workerId) } : {}) } },
      {
        $group: {
          _id: null,
          avg: { $avg: "$overall" },
          n: { $sum: 1 },
          quality: { $avg: "$quality" },
          communication: { $avg: "$communication" },
          punctuality: { $avg: "$punctuality" },
          professionalism: { $avg: "$professionalism" },
        },
      },
    ]);

    return ok({ items, total, page, limit, pages: Math.ceil(total / limit), summary: aggr[0] || null });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const body = await readJson<{ id?: string; status?: string; workerReply?: string }>(req);
    if (!body.id) throw new ApiError("Review id is required", 400);
    requireValidId(body.id);
    if (body.status && !["visible", "hidden", "removed"].includes(body.status)) {
      throw new ApiError("Invalid status", 400);
    }
    await connectDB();
    const review = await Review.findById(body.id);
    if (!review) throw new ApiError("Review not found", 404);
    if (body.status) review.status = body.status as never;
    if (body.workerReply !== undefined) review.workerReply = body.workerReply;
    await review.save();
    await logAudit(session, "review_moderated", `Review ${body.id} → ${body.status || "updated"}`, {
      entity: "Review",
      entityId: body.id,
    });
    return ok({ review });
  });
}
