import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ServiceRequest, Quotation, WorkerProfile } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);
    await connectDB();
    const request = await ServiceRequest.findById(id)
      .populate("categoryId", "name slug icon")
      .populate("customerId", "name phone avatarFileId")
      .lean();
    if (!request) return fail("Request not found", 404);

    const isOwner = request.customerId._id.toString() === session.sub;
    const isAdmin = session.role === "admin";
    if (!isOwner && !isAdmin && session.role !== "worker") return fail("Not authorized", 403);
    if (!isOwner && !isAdmin) {
      const invited = (request.invitedWorkerIds || []).some((w) => w.toString() === session.sub);
      // FR-REQ-09: providers can open any job that is still open for offers (open or quoted)
      if (!["open", "quoted"].includes(request.status) && !invited) return fail("Not authorized", 403);
    }

    const quotations = isOwner || isAdmin
      ? await Quotation.find({ requestId: id })
          .populate("workerId", "name phone avatarFileId")
          .sort({ total: 1 })
          .lean()
      : [];

    let myQuotation = null;
    if (session.role === "worker") {
      myQuotation = await Quotation.findOne({ requestId: id, workerId: session.sub }).lean();
      const profile = await WorkerProfile.findOne({ userId: session.sub })
        .select("profession status availability headline stats")
        .lean();
      return ok({ request, quotations, myQuotation, profile });
    }

    return ok({ request, quotations });
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["customer", "admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ action?: string; reason?: string }>(req);
    await connectDB();
    const request = await ServiceRequest.findById(id);
    if (!request) return fail("Request not found", 404);
    if (session.role !== "admin" && request.customerId.toString() !== session.sub) {
      return fail("Not your request", 403);
    }
    if (body.action === "cancel") {
      if (["booking_created", "cancelled"].includes(request.status)) {
        throw new ApiError("Request can no longer be cancelled", 409);
      }
      request.status = "cancelled";
      await request.save();
      const quotes = await Quotation.find({ requestId: request._id, status: "pending" });
      for (const q of quotes) {
        q.status = "withdrawn";
        q.customerNote = body.reason || "Request cancelled by customer";
        await q.save();
        await notify(q.workerId, {
          type: "request_cancelled",
          title: "Service request cancelled",
          body: `"${request.title}" was cancelled.`,
          link: "/dashboard/worker/requests",
          category: "booking",
        });
      }
      return ok({ request });
    }
    if (body.action === "close") {
      request.status = "expired";
      await request.save();
      return ok({ request });
    }
    throw new ApiError("Unknown action", 400);
  });
}
