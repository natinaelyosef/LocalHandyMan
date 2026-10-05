import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { PaymentPhase, PaymentProof, Booking, PaymentAccount } from "@/lib/models";
import { handle, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const p = req.nextUrl.searchParams;
    const only = p.get("status") || "all";
    await connectDB();

    const bookingFilter: Record<string, unknown> =
      session.role === "customer"
        ? { customerId: session.sub }
        : session.role === "worker"
          ? { workerId: session.sub }
          : p.get("bookingId")
            ? { _id: p.get("bookingId") }
            : {};

    const bookings = await Booking.find(bookingFilter)
      .select("code title status paymentSummary customerId workerId createdAt")
      .populate("customerId", "name")
      .populate("workerId", "name")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const bookingIds = bookings.map((b) => b._id);
    const phaseFilter: Record<string, unknown> = { bookingId: { $in: bookingIds } };
    if (only !== "all") phaseFilter.status = only;
    const phases = await PaymentPhase.find(phaseFilter)
      .sort({ bookingId: 1, order: 1 })
      .populate("paymentAccountId")
      .lean();

    const proofs = await PaymentProof.find({ bookingId: { $in: bookingIds } })
      .sort({ createdAt: -1 })
      .lean();
    const proofsByPhase: Record<string, typeof proofs> = {};
    for (const pf of proofs) {
      const k = pf.paymentPhaseId.toString();
      (proofsByPhase[k] ||= []).push(pf);
    }

    const bookingMap = Object.fromEntries(bookings.map((b) => [b._id.toString(), b]));
    const rows = phases.map((ph) => ({
      phase: ph,
      booking: bookingMap[ph.bookingId.toString()] || null,
      proofs: proofsByPhase[ph._id.toString()] || [],
    }));

    const totals = rows.reduce(
      (acc, r) => {
        acc.required += r.phase.amount;
        if (r.phase.status === "VERIFIED") acc.verified += r.phase.paidVerified;
        if (["PROOF_SUBMITTED", "UNDER_VERIFICATION"].includes(r.phase.status)) acc.pending += r.phase.amount;
        return acc;
      },
      { required: 0, verified: 0, pending: 0, remaining: 0 }
    );
    totals.remaining = Math.max(totals.required - totals.verified, 0);

    const account = await PaymentAccount.findOne({ active: true }).sort({ order: 1 }).lean();
    return ok({ rows, totals, account, disclaimer: "Records of manually made CBE payments — not processed by the platform." });
  });
}
