import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { PaymentPhase, PaymentProof, Booking, User } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { recomputePaymentSummary, advanceStatus } from "@/lib/services/booking";
import { notify } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ action?: "verify" | "reject"; reason?: string; note?: string }>(req);
    if (!body.action) throw new ApiError("Action is required", 400);

    await connectDB();
    const proof = await PaymentProof.findById(id);
    if (!proof) return fail("Proof not found", 404);
    if (proof.status !== "pending") throw new ApiError("This proof has already been reviewed", 409);

    const phase = await PaymentPhase.findById(proof.paymentPhaseId);
    const booking = await Booking.findById(proof.bookingId);
    if (!phase || !booking) return fail("Payment records not found", 404);

    if (body.action === "reject") {
      if (!body.reason) throw new ApiError("A rejection reason is required", 400);
      proof.status = "rejected";
      proof.rejectionReason = body.reason;
      proof.reviewedBy = new mongoose.Types.ObjectId(session.sub);
      proof.reviewedAt = new Date();
      proof.history.push({
        at: new Date(),
        status: "rejected",
        actorId: proof.reviewedBy,
        actorRole: "admin",
        note: body.reason,
      } as never);
      await proof.save();

      phase.status = "REJECTED";
      phase.rejectionReason = body.reason;
      phase.activeProofId = proof._id;
      phase.history.push({
        at: new Date(),
        status: "REJECTED",
        actorId: proof.reviewedBy,
        actorRole: "admin",
        note: body.reason,
      } as never);
      await phase.save();

      await User.updateOne({ _id: proof.customerId }, { $inc: { failedPaymentProofs: 1 } });
      if (booking.status === "PAYMENT_PROOF_SUBMITTED") {
        await advanceStatus(booking._id, "ADVANCE_PAYMENT_DUE", session, {
          note: `Payment proof rejected: ${body.reason}`,
          force: true,
        });
      }
      await recomputePaymentSummary(booking._id);
      await notify(proof.customerId, {
        type: "payment_rejected",
        title: "Payment proof rejected",
        body: `Reason: ${body.reason}. Please correct and resubmit for booking ${booking.code}.`,
        link: `/dashboard/customer/bookings/${booking._id}`,
        category: "payment",
      });
      await logAudit(session, "payment_proof_rejected", `Rejected proof ${proof.reference}: ${body.reason}`, {
        entity: "PaymentProof",
        entityId: proof._id.toString(),
      });
      return ok({ proof, phase });
    }

    proof.status = "verified";
    proof.reviewedBy = new mongoose.Types.ObjectId(session.sub);
    proof.reviewedAt = new Date();
    proof.history.push({
      at: new Date(),
      status: "verified",
      actorId: proof.reviewedBy,
      actorRole: "admin",
      note: body.note || "Verified by platform verifier",
    } as never);
    await proof.save();

    phase.status = "VERIFIED";
    phase.paidVerified = proof.amountPaid;
    phase.paidAt = proof.paidAt;
    phase.rejectionReason = "";
    phase.verifiedBy = proof.reviewedBy;
    phase.verifiedAt = new Date();
    phase.history.push({
      at: new Date(),
      status: "VERIFIED",
      actorId: proof.reviewedBy,
      actorRole: "admin",
      note: `${proof.amountPaid} ETB verified (ref ${proof.reference})`,
    } as never);
    await phase.save();

    if (booking.status === "PAYMENT_PROOF_SUBMITTED" || booking.status === "ADVANCE_PAYMENT_DUE") {
      await advanceStatus(booking._id, "PAYMENT_VERIFIED", session, {
        note: `Payment phase "${phase.label}" verified`,
        force: true,
      });
    }

    const nextPhase = await PaymentPhase.findOne({
      bookingId: booking._id,
      order: { $gt: phase.order },
      status: { $in: ["UNPAID", "REJECTED"] },
    }).sort({ order: 1 });
    if (nextPhase && nextPhase.status !== "VERIFIED") {
      nextPhase.status = "PAYMENT_DUE";
      nextPhase.history.push({
        at: new Date(),
        status: "PAYMENT_DUE",
        actorId: proof.reviewedBy,
        actorRole: "admin",
        note: "Next payment phase unlocked",
      } as never);
      await nextPhase.save();
      await notify(proof.customerId, {
        type: "payment_due",
        title: `Payment due: ${nextPhase.label}`,
        body: `${nextPhase.amount} ETB is now due for booking ${booking.code}.`,
        link: `/dashboard/customer/bookings/${booking._id}`,
        category: "payment",
      });
    } else if (!nextPhase) {
      const statuses = await PaymentPhase.find({ bookingId: booking._id }).select("status").lean();
      if (statuses.every((st) => st.status === "VERIFIED")) {
        const fresh = await Booking.findById(booking._id).select("status").lean();
        if (fresh && ["PAYMENT_VERIFIED", "PAYMENT_PROOF_SUBMITTED", "ADVANCE_PAYMENT_DUE"].includes(fresh.status)) {
          await advanceStatus(booking._id, "SCHEDULED", session, {
            note: "All payment phases verified — job scheduled",
            force: true,
          });
        }
      }
    }

    await recomputePaymentSummary(booking._id);
    await notify(proof.customerId, {
      type: "payment_verified",
      title: "Payment verified",
      body: `${phase.label} (${proof.amountPaid} ETB) has been verified for booking ${booking.code}.`,
      link: `/dashboard/customer/bookings/${booking._id}`,
      category: "payment",
    });
    await notify(booking.workerId, {
      type: "payment_verified",
      title: "Payment verified",
      body: `${phase.label} (${proof.amountPaid} ETB) verified for booking ${booking.code}.`,
      link: `/dashboard/worker/jobs/${booking._id}`,
      category: "payment",
    });
    await logAudit(session, "payment_proof_verified", `Verified proof ${proof.reference} (${proof.amountPaid} ETB)`, {
      entity: "PaymentProof",
      entityId: proof._id.toString(),
      meta: { phase: phase.label, booking: booking.code },
    });

    return ok({ proof, phase, nextPhaseId: nextPhase?._id || null });
  });
}
