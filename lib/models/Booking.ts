import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { BOOKING_STATUSES, JOB_PHASE_STATUSES } from "../constants";
import { LocationSnapshotSchema } from "./Request";

const TimelineEntrySchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorRole: { type: String, default: "system" },
    action: { type: String, required: true },
    note: { type: String, default: "" },
    from: { type: String, default: "" },
    to: { type: String, default: "" },
  },
  { _id: false }
);

const BookingSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    requestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true, index: true },
    quotationId: { type: Schema.Types.ObjectId, ref: "Quotation", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerProfileId: { type: Schema.Types.ObjectId, ref: "WorkerProfile", default: null },
    categoryId: { type: Schema.Types.ObjectId, ref: "ServiceCategory", default: null },
    title: { type: String, required: true },
    description: { type: String, default: "" },
    urgency: { type: String, default: "normal" },
    location: { type: LocationSnapshotSchema, default: () => ({}) },
    status: { type: String, enum: BOOKING_STATUSES, default: "REQUESTED", index: true },
    agreedTotal: { type: Number, required: true, min: 0 },
    startDate: { type: Date, default: null },
    scheduledTime: { type: String, default: "", trim: true },
    expectedCompletion: { type: Date, default: null },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    confirmedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    cancellationReason: { type: String, default: "" },
    cancelledBy: { type: String, enum: ["customer", "worker", "admin", ""], default: "" },
    warrantyDays: { type: Number, default: 0, min: 0 },
    warrantyEndsAt: { type: Date, default: null },
    progressPercent: { type: Number, default: 0, min: 0, max: 100 },
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", default: null },
    jobPhaseIds: { type: [Schema.Types.ObjectId], ref: "JobPhase", default: [] },
    paymentPhaseIds: { type: [Schema.Types.ObjectId], ref: "PaymentPhase", default: [] },
    timeline: { type: [TimelineEntrySchema], default: [] },
    reviewed: { type: Boolean, default: false },
    disputeOpen: { type: Boolean, default: false },
    customerConfirmed: { type: Boolean, default: false },
    paymentSummary: {
      total: { type: Number, default: 0 },
      verified: { type: Number, default: 0 },
      pending: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 },
    },
  },
  { timestamps: true }
);

const JobPhaseSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    order: { type: Number, required: true, min: 1 },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    amount: { type: Number, default: 0, min: 0 },
    startDate: { type: Date, default: null },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: JOB_PHASE_STATUSES, default: "NOT_STARTED", index: true },
    notes: { type: String, default: "" },
    paymentPhaseId: { type: Schema.Types.ObjectId, ref: "PaymentPhase", default: null },
    evidence: {
      before: { type: [Schema.Types.ObjectId], ref: "FileAsset", default: [] },
      during: { type: [Schema.Types.ObjectId], ref: "FileAsset", default: [] },
      after: { type: [Schema.Types.ObjectId], ref: "FileAsset", default: [] },
    },
    startedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    percent: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

export type BookingDoc = InferSchemaType<typeof BookingSchema>;
export type JobPhaseDoc = InferSchemaType<typeof JobPhaseSchema>;
export type TimelineEntry = InferSchemaType<typeof TimelineEntrySchema>;

export const Booking: Model<BookingDoc> = models.Booking || model("Booking", BookingSchema);
export const JobPhase: Model<JobPhaseDoc> = models.JobPhase || model("JobPhase", JobPhaseSchema);

export function buildTimelineEntry(
  action: string,
  opts: Partial<TimelineEntry> = {}
): TimelineEntry {
  return {
    at: new Date(),
    action,
    note: opts.note ?? "",
    actorId: opts.actorId ?? null,
    actorRole: opts.actorRole ?? "system",
    from: opts.from ?? "",
    to: opts.to ?? "",
  } as TimelineEntry;
}
