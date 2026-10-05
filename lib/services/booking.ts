import mongoose from "mongoose";
import { connectDB } from "../db";
import {
  Booking,
  JobPhase,
  PaymentPhase,
  PaymentAccount,
  Quotation,
  ServiceRequest,
  Conversation,
} from "../models";
import { BookingStatus, TERMINAL_BOOKING_STATUSES } from "../constants";
import { ApiError } from "../http";
import { buildTimelineEntry } from "../models/Booking";
import { notify } from "./notify";
import { logAudit } from "./audit";
import type { SessionPayload } from "../auth";

const NEXT: Record<BookingStatus, BookingStatus[]> = {
  REQUESTED: ["QUOTATION_SENT", "CANCELLED", "EXPIRED"],
  QUOTATION_SENT: ["QUOTATION_ACCEPTED", "REQUESTED", "CANCELLED", "REJECTED", "EXPIRED"],
  QUOTATION_ACCEPTED: ["BOOKING_CONFIRMED", "CANCELLED"],
  BOOKING_CONFIRMED: ["ADVANCE_PAYMENT_DUE", "CANCELLED"],
  ADVANCE_PAYMENT_DUE: ["PAYMENT_PROOF_SUBMITTED", "CANCELLED", "DISPUTED"],
  PAYMENT_PROOF_SUBMITTED: ["PAYMENT_VERIFIED", "ADVANCE_PAYMENT_DUE", "CANCELLED", "DISPUTED"],
  PAYMENT_VERIFIED: ["SCHEDULED", "CANCELLED", "DISPUTED"],
  SCHEDULED: ["WORKER_ON_THE_WAY", "CANCELLED", "DISPUTED"],
  WORKER_ON_THE_WAY: ["WORK_STARTED", "CANCELLED", "DISPUTED"],
  WORK_STARTED: ["IN_PROGRESS", "CANCELLED", "DISPUTED"],
  IN_PROGRESS: ["AWAITING_CUSTOMER", "READY_FOR_REVIEW", "COMPLETED", "DISPUTED", "CANCELLED"],
  AWAITING_CUSTOMER: ["READY_FOR_REVIEW", "COMPLETED", "DISPUTED"],
  READY_FOR_REVIEW: ["COMPLETED", "DISPUTED"],
  COMPLETED: ["CUSTOMER_CONFIRMED", "DISPUTED"],
  CUSTOMER_CONFIRMED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
  REJECTED: [],
  DISPUTED: ["CLOSED", "CANCELLED", "COMPLETED"],
  EXPIRED: [],
};

export function canTransition(from: BookingStatus, to: BookingStatus): boolean {
  if (from === to) return false;
  if (TERMINAL_BOOKING_STATUSES.includes(from) && to !== "DISPUTED") return from === "CLOSED" && to === "CLOSED";
  return (NEXT[from] || []).includes(to);
}

export async function advanceStatus(
  bookingId: string | mongoose.Types.ObjectId,
  to: BookingStatus,
  actor: SessionPayload | null,
  opts: { note?: string; force?: boolean; category?: "booking" | "payment" } = {}
) {
  await connectDB();
  const booking = await Booking.findById(bookingId);
  if (!booking) throw new ApiError("Booking not found", 404);
  const from = booking.status as BookingStatus;
  if (from === to) return booking;
  if (!opts.force && !canTransition(from, to)) {
    throw new ApiError(`Cannot move booking from ${from} to ${to}`, 409);
  }
  booking.status = to;
  const entry = buildTimelineEntry("status_changed", {
    actorId: actor ? new mongoose.Types.ObjectId(actor.sub) : null,
    actorRole: actor?.role ?? "system",
    from,
    to,
    note: opts.note ?? "",
  });
  booking.timeline.push(entry as never);
  const now = new Date();
  if (to === "WORK_STARTED" && !booking.startedAt) booking.startedAt = now;
  if (to === "COMPLETED") booking.completedAt = now;
  if (to === "CUSTOMER_CONFIRMED") booking.confirmedAt = now;
  if (to === "CLOSED") booking.closedAt = now;
  if (to === "COMPLETED" && booking.warrantyDays > 0) {
    booking.warrantyEndsAt = new Date(now.getTime() + booking.warrantyDays * 86400000);
  }
  await booking.save();
  return booking;
}

export function computeTotals(phases: { amount: number; paidVerified: number; status: string }[]) {
  const total = phases.reduce((s, p) => s + p.amount, 0);
  const verified = phases.filter((p) => p.status === "VERIFIED").reduce((s, p) => s + p.paidVerified, 0);
  const pending = phases
    .filter((p) => p.status === "PROOF_SUBMITTED" || p.status === "UNDER_VERIFICATION")
    .reduce((s, p) => s + p.amount - p.paidVerified, 0);
  return { total, verified, pending, remaining: Math.max(total - verified, 0) };
}

export async function recomputePaymentSummary(bookingId: string | mongoose.Types.ObjectId) {
  await connectDB();
  const phases = await PaymentPhase.find({ bookingId }).lean();
  const summary = computeTotals(phases);
  await Booking.updateOne({ _id: bookingId }, { $set: { paymentSummary: summary, agreedTotal: summary.total } });
  return summary;
}

export function splitAmount(total: number, percents: { label: string; percent: number }[]) {
  const amounts: { label: string; amount: number; percent: number }[] = [];
  let allocated = 0;
  percents.forEach((p, i) => {
    const isLast = i === percents.length - 1;
    const amount = isLast ? total - allocated : Math.round((total * p.percent) / 100);
    allocated += amount;
    amounts.push({ label: p.label, amount, percent: p.percent });
  });
  return amounts;
}

const DEFAULT_PAYMENT_PLAN = [
  { label: "Advance payment", percent: 30 },
  { label: "Work progress", percent: 40 },
  { label: "Final payment", percent: 30 },
];

const DEFAULT_JOB_PHASES = [
  { name: "Inspection & assessment", description: "Worker inspects the site/problem and confirms materials needed." },
  { name: "Main work", description: "Core service delivery as agreed in the quotation." },
  { name: "Testing & completion", description: "Final checks, cleanup and handover to the customer." },
];

export async function createBookingFromQuotation(quotationId: string, actor: SessionPayload) {
  await connectDB();
  const quotation = await Quotation.findById(quotationId);
  if (!quotation) throw new ApiError("Quotation not found", 404);
  if (quotation.status !== "pending") throw new ApiError("Quotation is no longer pending", 409);
  if (quotation.customerId.toString() !== actor.sub) throw new ApiError("Not your quotation", 403);

  const request = await ServiceRequest.findById(quotation.requestId);
  if (!request) throw new ApiError("Service request not found", 404);
  if (request.status === "booking_created") throw new ApiError("This request already has a booking", 409);

  const otherQuotes = await Quotation.find({
    requestId: request._id,
    _id: { $ne: quotation._id },
    status: "pending",
  });
  for (const q of otherQuotes) {
    q.status = "rejected";
    q.customerNote = "Customer selected another worker";
    q.respondedAt = new Date();
    await q.save();
    await notify(q.workerId, {
      type: "quotation_closed",
      title: "Quotation not selected",
      body: `The customer selected another worker for "${request.title}".`,
      link: `/dashboard/worker/requests/${request._id}`,
      category: "booking",
    });
  }

  quotation.status = "accepted";
  quotation.respondedAt = new Date();
  request.status = "booking_created";

  const total = quotation.total;
  const plan =
    quotation.paymentPlan && quotation.paymentPlan.length >= 2 ? quotation.paymentPlan : DEFAULT_PAYMENT_PLAN;

  const booking = await Booking.create({
    code: `BK${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`,
    requestId: request._id,
    quotationId: quotation._id,
    customerId: quotation.customerId,
    workerId: quotation.workerId,
    title: request.title,
    description: request.description,
    urgency: request.urgency,
    location: request.location,
    status: "BOOKING_CONFIRMED",
    agreedTotal: total,
    startDate: quotation.proposedStartDate || request.preferredDate || null,
    expectedCompletion: quotation.proposedEndDate || null,
    warrantyDays: quotation.warrantyDays || 0,
    timeline: [
      buildTimelineEntry("booking_created", {
        actorId: new mongoose.Types.ObjectId(actor.sub),
        actorRole: actor.role,
        note: `Booking created from quotation of ${total} ETB`,
      }),
    ],
    paymentSummary: { total, verified: 0, pending: 0, remaining: total },
  });

  const jobPhases = await JobPhase.insertMany(
    DEFAULT_JOB_PHASES.map((p, i) => ({
      bookingId: booking._id,
      order: i + 1,
      name: p.name,
      description: p.description,
      amount: i === DEFAULT_JOB_PHASES.length - 1 ? total : 0,
      status: "NOT_STARTED",
      dueDate: quotation.proposedEndDate || null,
    }))
  );

  const account = await PaymentAccount.findOne({ active: true }).sort({ order: 1 });
  const split = splitAmount(total, plan);
  const dueIn = 3 * 86400000;
  const paymentPhases = await PaymentPhase.insertMany(
    split.map((s, i) => ({
      bookingId: booking._id,
      order: i + 1,
      label: s.label,
      purpose: i === 0 ? "Advance payment required before work starts" : "",
      amount: s.amount,
      status: "UNPAID",
      dueDate: new Date(Date.now() + dueIn),
      paymentAccountId: account?._id ?? null,
      jobPhaseId: jobPhases[Math.min(i, jobPhases.length - 1)]?._id ?? null,
      history: [
        {
          at: new Date(),
          status: "UNPAID",
          actorId: null,
          actorRole: "system",
          note: "Payment phase created with booking",
        },
      ],
    }))
  );

  await PaymentPhase.updateOne(
    { _id: paymentPhases[0]._id },
    { $set: { status: "PAYMENT_DUE" }, $push: { history: { at: new Date(), status: "PAYMENT_DUE", actorRole: "system", note: "First payment phase is due" } } }
  );

  booking.jobPhaseIds = jobPhases.map((p) => p._id);
  booking.paymentPhaseIds = paymentPhases.map((p) => p._id);
  booking.conversationId = await ensureConversation(
    booking.customerId.toString(),
    booking.workerId.toString(),
    booking._id as mongoose.Types.ObjectId
  );
  booking.status = "ADVANCE_PAYMENT_DUE";
  booking.timeline.push(
    buildTimelineEntry("status_changed", {
      actorId: new mongoose.Types.ObjectId(actor.sub),
      actorRole: actor.role,
      from: "BOOKING_CONFIRMED",
      to: "ADVANCE_PAYMENT_DUE",
      note: "Advance payment phase is now due",
    }) as never
  );
  await booking.save();

  quotation.bookingId = booking._id;
  await quotation.save();
  request.bookingId = booking._id;
  await request.save();

  await notify(quotation.workerId, {
    type: "quotation_accepted",
    title: "Quotation accepted",
    body: `Your quotation for "${request.title}" was accepted. Booking ${booking.code} is confirmed.`,
    link: `/dashboard/worker/jobs/${booking._id}`,
    category: "booking",
  });
  await notify(quotation.customerId, {
    type: "booking_confirmed",
    title: "Booking confirmed",
    body: `Booking ${booking.code} created. Pay the advance phase of ${paymentPhases[0].amount} ETB via CBE.`,
    link: `/dashboard/customer/bookings/${booking._id}`,
    category: "payment",
  });
  await logAudit(actor, "booking_created", `Booking ${booking.code} created`, {
    entity: "Booking",
    entityId: booking._id.toString(),
    meta: { total },
  });

  return booking;
}

export async function ensureConversation(
  customerId: string,
  workerId: string,
  bookingId?: mongoose.Types.ObjectId | null
): Promise<mongoose.Types.ObjectId> {
  await connectDB();
  // A thread is scoped to a booking when one is given. Without a bookingId we
  // always use the pair's pre-booking thread — never their booking thread.
  const query: Record<string, unknown> = { customerId, workerId, bookingId: bookingId ?? null };
  let convo = await Conversation.findOne(query);
  if (!convo) {
    convo = await Conversation.create({
      participants: [customerId, workerId],
      customerId,
      workerId,
      bookingId: bookingId ?? null,
    });
  }
  return convo._id as mongoose.Types.ObjectId;
}
