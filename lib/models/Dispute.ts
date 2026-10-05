import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import {
  COMPLAINT_CATEGORIES,
  DISPUTE_OUTCOMES,
  DISPUTE_PRIORITIES,
  DISPUTE_STATUSES,
} from "../constants";

/**
 * A single entry in the case conversation. `internal` marks an admin-only
 * investigation note that the customer and worker must never see.
 */
const DisputeMessageSchema = new Schema(
  {
    at: { type: Date, default: Date.now },
    authorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    authorRole: { type: String, default: "" },
    body: { type: String, default: "", maxlength: 4000 },
    fileIds: { type: [Schema.Types.ObjectId], ref: "FileAsset", default: [] },
    internal: { type: Boolean, default: false },
  },
  { _id: false }
);

/** Append-only audit trail of status/assignment/resolution changes. */
const DisputeTimelineSchema = new Schema(
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

const DisputeSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    raisedBy: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    againstUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    category: { type: String, enum: COMPLAINT_CATEGORIES, required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, required: true, trim: true, maxlength: 4000 },
    status: { type: String, enum: DISPUTE_STATUSES, default: "open", index: true },
    priority: { type: String, enum: DISPUTE_PRIORITIES, default: "normal", index: true },
    evidenceFileIds: { type: [Schema.Types.ObjectId], ref: "FileAsset", default: [] },
    messages: { type: [DisputeMessageSchema], default: [] },
    timeline: { type: [DisputeTimelineSchema], default: [] },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    resolution: {
      // "" means "not yet resolved" — the enum must admit it or Mongoose
      // rejects the default on create.
      outcome: { type: String, enum: ["", ...DISPUTE_OUTCOMES], default: "" },
      refundAmount: { type: Number, default: 0, min: 0 },
      notes: { type: String, default: "", maxlength: 2000 },
      resolvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
      resolvedAt: { type: Date, default: null },
    },
    firstResponseAt: { type: Date, default: null },
    lastMessageAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DisputeSchema.index({ status: 1, createdAt: -1 });
DisputeSchema.index({ raisedBy: 1, status: 1 });
DisputeSchema.index({ againstUserId: 1, status: 1 });

export type DisputeDoc = InferSchemaType<typeof DisputeSchema>;
export type DisputeTimelineEntry = InferSchemaType<typeof DisputeTimelineSchema>;

export const Dispute: Model<DisputeDoc> = models.Dispute || model("Dispute", DisputeSchema);

export function buildDisputeTimelineEntry(
  action: string,
  opts: Partial<DisputeTimelineEntry> = {}
): DisputeTimelineEntry {
  return {
    at: new Date(),
    action,
    note: opts.note ?? "",
    actorId: opts.actorId ?? null,
    actorRole: opts.actorRole ?? "system",
    from: opts.from ?? "",
    to: opts.to ?? "",
  } as DisputeTimelineEntry;
}
