import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking, PaymentPhase, PaymentAccount } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { buildTimelineEntry } from "@/lib/models/Booking";
import { recomputePaymentSummary, splitAmount } from "@/lib/services/booking";
import { notify } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";
import mongoose from "mongoose";

interface PlanItem {
  label: string;
  amount?: number;
  percent?: number;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["worker", "admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ plan?: PlanItem[]; dueDates?: string[] }>(req);
    if (!body.plan || body.plan.length < 1) throw new ApiError("At least one payment phase is required", 400);
    if (body.plan.length > 10) throw new ApiError("Maximum 10 payment phases", 400);

    await connectDB();
    const booking = await Booking.findById(id);
    if (!booking) return fail("Booking not found", 404);
    if (session.role !== "admin" && booking.workerId.toString() !== session.sub) {
      return fail("Not your booking", 403);
    }
    const existing = await PaymentPhase.find({ bookingId: id }).lean();
    if (existing.some((p) => ["VERIFIED", "PROOF_SUBMITTED", "UNDER_VERIFICATION"].includes(p.status))) {
      throw new ApiError("Payment phases cannot be changed after a proof has been submitted or verified", 409);
    }

    const total = booking.agreedTotal;
    const usesPercent = body.plan.every((p) => typeof p.percent === "number" && p.percent > 0);
    let splits: { label: string; amount: number }[];
    if (usesPercent) {
      const sum = body.plan.reduce((s, p) => s + (p.percent || 0), 0);
      if (sum !== 100) throw new ApiError(`Percentages must total 100% (currently ${sum}%)`, 400);
      splits = splitAmount(total, body.plan.map((p) => ({ label: p.label, percent: p.percent! })));
    } else {
      const sum = body.plan.reduce((s, p) => s + Number(p.amount || 0), 0);
      if (sum !== total) throw new ApiError(`Phase amounts must total the agreed price (${total} ETB, got ${sum})`, 400);
      splits = body.plan.map((p) => ({ label: p.label, amount: Number(p.amount) }));
    }

    await PaymentPhase.deleteMany({ bookingId: id });
    const account = await PaymentAccount.findOne({ active: true }).sort({ order: 1 });
    const dueDates = body.dueDates || [];
    const created = await PaymentPhase.insertMany(
      splits.map((s, i) => ({
        bookingId: id,
        order: i + 1,
        label: s.label,
        amount: s.amount,
        status: i === 0 ? "PAYMENT_DUE" : "UNPAID",
        dueDate: dueDates[i] ? new Date(dueDates[i]) : new Date(Date.now() + (i + 1) * 3 * 86400000),
        paymentAccountId: account?._id ?? null,
        history: [
          { at: new Date(), status: i === 0 ? "PAYMENT_DUE" : "UNPAID", actorId: new mongoose.Types.ObjectId(session.sub), actorRole: session.role, note: "Payment plan configured" },
        ],
      }))
    );

    booking.paymentPhaseIds = created.map((p) => p._id);
    booking.timeline.push(
      buildTimelineEntry("payment_plan_updated", {
        actorId: new mongoose.Types.ObjectId(session.sub),
        actorRole: session.role,
        note: `Payment plan set: ${splits.map((s) => `${s.label} ${s.amount}`).join(", ")}`,
      }) as never
    );
    await booking.save();
    await recomputePaymentSummary(id);
    await notify(booking.customerId, {
      type: "payment_plan_updated",
      title: "Payment plan updated",
      body: `${created.length} payment phases configured for booking ${booking.code}.`,
      link: `/dashboard/customer/bookings/${id}`,
      category: "payment",
    });
    await logAudit(session, "payment_plan_updated", `Payment plan updated for ${booking.code}`, {
      entity: "Booking",
      entityId: id,
    });

    return ok({ phases: created });
  });
}
