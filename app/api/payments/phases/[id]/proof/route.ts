import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { PaymentPhase, PaymentProof, Booking, User, PaymentAccount } from "@/lib/models";
import { handle, ok, fail, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { saveUpload } from "@/lib/services/files";
import { recomputePaymentSummary, advanceStatus } from "@/lib/services/booking";
import { notify, notifyMany } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";
import { PLATFORM_DISCLAIMER } from "@/lib/constants";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["customer"]);
    const { id } = await ctx.params;
    requireValidId(id);

    const form = await req.formData();
    const amountPaid = Number(form.get("amountPaid") || 0);
    const reference = String(form.get("reference") || "").trim();
    const senderName = String(form.get("senderName") || "").trim();
    const senderAccount = String(form.get("senderAccount") || "").trim();
    const paidAtRaw = String(form.get("paidAt") || "");
    const note = String(form.get("note") || "");
    const bank = String(form.get("bank") || "Commercial Bank of Ethiopia");
    const screenshot = form.get("screenshot");

    if (!reference || reference.length < 4) throw new ApiError("Transaction reference is required", 400);
    if (!senderName) throw new ApiError("Sender name is required", 400);
    if (!amountPaid || amountPaid <= 0) throw new ApiError("Amount paid is required", 400);
    if (!paidAtRaw) throw new ApiError("Payment date is required", 400);
    if (!screenshot || typeof screenshot === "string") throw new ApiError("Payment screenshot is required", 400);

    await connectDB();
    const phase = await PaymentPhase.findById(id);
    if (!phase) return fail("Payment phase not found", 404);

    const booking = await Booking.findById(phase.bookingId);
    if (!booking) return fail("Booking not found", 404);
    if (booking.customerId.toString() !== session.sub) return fail("Not your booking", 403);
    if (["VERIFIED", "CANCELLED"].includes(phase.status)) {
      throw new ApiError("This payment phase is already settled", 409);
    }

    const duplicate = await PaymentProof.findOne({
      bookingId: booking._id,
      paymentPhaseId: phase._id,
      reference: { $regex: new RegExp(`^${reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      status: { $ne: "rejected" },
    });
    const sameRefOtherPlace = await PaymentProof.findOne({
      reference: { $regex: new RegExp(`^${reference.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") },
      status: { $in: ["pending", "verified"] },
    });

    const underpaidBy = Math.max(phase.amount - amountPaid, 0);
    const overpaidBy = Math.max(amountPaid - phase.amount, 0);

    const asset = await saveUpload(screenshot, session.sub, "payment_proof");

    const proof = await PaymentProof.create({
      reference,
      paymentPhaseId: phase._id,
      bookingId: booking._id,
      customerId: session.sub,
      amountPaid,
      requiredAmount: phase.amount,
      bank,
      senderName,
      senderAccount,
      receiverAccount: phase.paymentAccountId ? String((await PaymentAccount.findById(phase.paymentAccountId))?.accountNumber || "") : "",
      paidAt: new Date(paidAtRaw),
      note,
      screenshotFileId: asset._id,
      status: "pending",
      duplicateFlag: !!duplicate || !!sameRefOtherPlace,
      underpaidBy,
      overpaidBy,
      history: [{ at: new Date(), status: "pending", actorId: session.sub, actorRole: "customer", note: "Proof submitted by customer" }],
    });
    asset.entityId = booking._id;
    await asset.save();

    phase.status = "PROOF_SUBMITTED";
    phase.activeProofId = proof._id;
    phase.rejectionReason = "";
    phase.history.push({
      at: new Date(),
      status: "PROOF_SUBMITTED",
      actorId: session.sub,
      actorRole: "customer",
      note: `Reference ${reference}, ${amountPaid} ETB`,
    } as never);
    await phase.save();

    if (booking.status === "ADVANCE_PAYMENT_DUE" || booking.status === "PAYMENT_VERIFIED") {
      await advanceStatus(booking._id, "PAYMENT_PROOF_SUBMITTED", session, {
        note: `Payment proof submitted for ${phase.label}`,
        force: true,
      });
    }

    await recomputePaymentSummary(booking._id);
    await logAudit(session, "payment_proof_submitted", `Proof ${reference} (${amountPaid} ETB) for ${phase.label} on ${booking.code}`, {
      entity: "PaymentProof",
      entityId: proof._id.toString(),
      meta: { duplicate: !!duplicate, underpaidBy, overpaidBy },
    });

    const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
    await notifyMany(
      admins.map((a) => a._id),
      {
        type: "payment_proof_pending",
        title: "Payment proof awaiting verification",
        body: `${senderName} submitted ${amountPaid} ETB (ref ${reference}) for booking ${booking.code}, phase "${phase.label}".`,
        link: "/dashboard/admin/payments",
        category: "payment",
      }
    );
    await notify(booking.workerId, {
      type: "payment_proof_submitted",
      title: "Customer submitted payment proof",
      body: `${phase.label}: ${amountPaid} ETB awaiting verification.`,
      link: `/dashboard/worker/jobs/${booking._id}`,
      category: "payment",
    });

    let warning: string | undefined;
    if (proof.duplicateFlag) warning = "Possible duplicate payment proof detected — a verifier will review it.";
    if (underpaidBy > 0) warning = `Underpayment: ${underpaidBy} ETB remains for this phase.`;
    if (overpaidBy > 0) warning = `Submitted amount exceeds the required phase amount by ${overpaidBy} ETB.`;

    return ok({
      proof,
      warning,
      disclaimer: PLATFORM_DISCLAIMER,
      message: "Payment proof submitted and is pending manual verification.",
    });
  });
}
