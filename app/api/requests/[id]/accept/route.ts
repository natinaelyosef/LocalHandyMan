import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ServiceRequest, Quotation, WorkerProfile, User } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/**
 * POST /api/requests/[id]/accept  (FR-QUOTE-07…10, BR-06)
 *
 * One-click "Accept job" from a service provider. It creates a pending offer
 * (Quotation with source: "accept") priced at the customer's budget by default
 * or at the price agreed in chat. It never creates a booking — the customer
 * must confirm via PATCH /api/quotations/[id] { action: "accept" }.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const { id } = await ctx.params;
    requireValidId(id);
    // An empty body is allowed: the price then falls back to the customer's budget.
    const body = await readJson<{ price?: number; note?: string }>(req).catch(() => ({}) as { price?: number; note?: string });

    await connectDB();
    const request = await ServiceRequest.findById(id);
    if (!request) return fail("Request not found", 404);

    if (request.customerId.toString() === session.sub) {
      throw new ApiError("You cannot accept your own request", 400);
    }
    if (!["open", "quoted"].includes(request.status)) {
      throw new ApiError("This job is no longer open for offers", 409);
    }

    const existing = await Quotation.findOne({ requestId: id, workerId: session.sub });
    if (existing && existing.status !== "withdrawn") {
      throw new ApiError("You already submitted an offer for this job", 409);
    }

    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);
    if (profile.status !== "approved") throw new ApiError("Your profile must be verified before accepting jobs", 403);
    if (profile.availability === "offline") {
      throw new ApiError("You are offline. Update availability first.", 409);
    }

    const price = Number(body.price || request.budget || 0);
    if (!(price > 0)) {
      throw new ApiError("Enter the agreed price — this request has no budget listed", 400);
    }

    const responseMinutes = Math.round((Date.now() - new Date(request.createdAt).getTime()) / 60000);

    const quotation = await Quotation.create({
      requestId: request._id,
      workerId: session.sub,
      customerId: request.customerId,
      laborCost: price,
      materialsCost: 0,
      transportCost: 0,
      otherCost: 0,
      total: price,
      estimatedDuration: "",
      paymentPlan: [
        { label: "Advance payment", percent: 30 },
        { label: "Work progress", percent: 40 },
        { label: "Final payment", percent: 30 },
      ],
      notes: body.note ? String(body.note).slice(0, 3000) : "Accepted this job",
      source: "accept",
      status: "pending",
      responseMinutes,
    });

    if (request.status === "open") {
      request.status = "quoted";
      await request.save();
    }

    profile.responseTimeMinutes = Math.round(
      profile.responseTimeMinutes * 0.7 + Math.min(responseMinutes, 480) * 0.3
    );
    await profile.save();

    const author = await User.findById(session.sub).select("name").lean();
    const workerName = author?.name || "A service provider";
    await notify(request.customerId, {
      type: "quotation_received",
      title: "A worker accepted your job",
      body: `${workerName} accepted "${request.title}" at ${price} ETB — review and confirm.`,
      link: `/dashboard/customer/requests/${request._id}`,
      category: "booking",
    });

    await logAudit(session, "quotation_accepted_intent", `Accepted job ${request.reference} at ${price} ETB`, {
      entity: "Quotation",
      entityId: quotation._id.toString(),
      meta: { total: price, source: "accept" },
    });

    return ok({ quotation, status: "pending_customer" });
  });
}
