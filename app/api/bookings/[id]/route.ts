import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking, JobPhase, PaymentPhase, PaymentProof, PaymentAccount, Quotation, ServiceRequest, Conversation } from "@/lib/models";
import { handle, ok, fail, requireValidId } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { canTransition, recomputePaymentSummary } from "@/lib/services/booking";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);
    await connectDB();

    const booking = await Booking.findById(id)
      .populate("customerId", "name phone email avatarFileId")
      .populate("workerId", "name phone email avatarFileId")
      .populate("categoryId", "name slug")
      .lean();
    if (!booking) return fail("Booking not found", 404);

    const isParticipant =
      booking.customerId._id.toString() === session.sub ||
      booking.workerId._id.toString() === session.sub;
    if (!isParticipant && session.role !== "admin") return fail("Not authorized", 404);

    const [jobPhases, paymentPhases, quotation, request, conversation] = await Promise.all([
      JobPhase.find({ bookingId: id }).sort({ order: 1 }).lean(),
      PaymentPhase.find({ bookingId: id }).sort({ order: 1 }).populate("paymentAccountId").lean(),
      Quotation.findById(booking.quotationId).lean(),
      ServiceRequest.findById(booking.requestId).select("title description mediaFileIds measurements requiredMaterials accessInstructions specialInstructions preferredDate preferredTime urgency").lean(),
      Conversation.findOne({ bookingId: id }).select("_id lastMessage lastMessageAt").lean(),
    ]);

    const proofIds = paymentPhases.map((p) => p.activeProofId).filter(Boolean);
    const proofs = proofIds.length
      ? await PaymentProof.find({ _id: { $in: proofIds } }).lean()
      : [];
    const proofMap = Object.fromEntries(proofs.map((p) => [p._id.toString(), p]));

    const can: Record<string, string[]> = {};
    for (const s of ["SCHEDULED", "WORKER_ON_THE_WAY", "WORK_STARTED", "IN_PROGRESS", "AWAITING_CUSTOMER", "READY_FOR_REVIEW", "COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED", "CANCELLED", "DISPUTED"] as const) {
      if (canTransition(booking.status as never, s)) can[s] = [];
    }

    if (session.role === "customer") await recomputePaymentSummary(id);

    const paymentAccounts = await PaymentAccount.find({ active: true }).sort({ order: 1 }).lean();

    return ok({
      booking: { ...booking, allowedTransitions: can },
      jobPhases,
      paymentPhases: paymentPhases.map((p) => ({
        ...p,
        proof: p.activeProofId ? proofMap[p.activeProofId.toString()] || null : null,
      })),
      quotation,
      request,
      conversation,
      accounts: paymentAccounts,
      viewer: { role: session.role, id: session.sub },
    });
  });
}
