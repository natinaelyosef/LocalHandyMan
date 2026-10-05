import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { PAYMENT_PHASE_STATUSES } from "../constants";

const PaymentAccountSchema = new Schema(
  {
    bank: { type: String, default: "Commercial Bank of Ethiopia" },
    accountName: { type: String, required: true },
    accountNumber: { type: String, required: true },
    branch: { type: String, default: "" },
    instructions: { type: String, default: "" },
    active: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const PaymentPhaseSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    order: { type: Number, required: true, min: 1 },
    label: { type: String, required: true, trim: true }, // Advance, Materials, Completion...
    purpose: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },
    paidVerified: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: PAYMENT_PHASE_STATUSES, default: "UNPAID", index: true },
    dueDate: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paymentAccountId: { type: Schema.Types.ObjectId, ref: "PaymentAccount", default: null },
    jobPhaseId: { type: Schema.Types.ObjectId, ref: "JobPhase", default: null },
    activeProofId: { type: Schema.Types.ObjectId, ref: "PaymentProof", default: null },
    rejectionReason: { type: String, default: "" },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    reminderCount: { type: Number, default: 0 },
    lastReminderAt: { type: Date, default: null },
    history: {
      type: [
        {
          at: { type: Date, default: Date.now },
          status: { type: String, required: true },
          actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
          actorRole: { type: String, default: "" },
          note: { type: String, default: "" },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

const PaymentProofSchema = new Schema(
  {
    reference: { type: String, required: true, trim: true, index: true },
    paymentPhaseId: { type: Schema.Types.ObjectId, ref: "PaymentPhase", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountPaid: { type: Number, required: true, min: 0 },
    requiredAmount: { type: Number, required: true, min: 0 },
    bank: { type: String, default: "Commercial Bank of Ethiopia" },
    senderName: { type: String, required: true },
    senderAccount: { type: String, default: "" },
    receiverAccount: { type: String, default: "" },
    paidAt: { type: Date, required: true },
    note: { type: String, default: "" },
    screenshotFileId: { type: Schema.Types.ObjectId, ref: "FileAsset", required: true },
    status: { type: String, enum: ["pending", "verified", "rejected"], default: "pending", index: true },
    rejectionReason: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedAt: { type: Date, default: null },
    duplicateFlag: { type: Boolean, default: false },
    underpaidBy: { type: Number, default: 0 },
    overpaidBy: { type: Number, default: 0 },
    history: {
      type: [
        {
          at: { type: Date, default: Date.now },
          status: { type: String, required: true },
          actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
          actorRole: { type: String, default: "" },
          note: { type: String, default: "" },
          _id: false,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
);

export type PaymentAccountDoc = InferSchemaType<typeof PaymentAccountSchema>;
export type PaymentPhaseDoc = InferSchemaType<typeof PaymentPhaseSchema>;
export type PaymentProofDoc = InferSchemaType<typeof PaymentProofSchema>;

export const PaymentAccount: Model<PaymentAccountDoc> =
  models.PaymentAccount || model("PaymentAccount", PaymentAccountSchema);
export const PaymentPhase: Model<PaymentPhaseDoc> =
  models.PaymentPhase || model("PaymentPhase", PaymentPhaseSchema);
export const PaymentProof: Model<PaymentProofDoc> =
  models.PaymentProof || model("PaymentProof", PaymentProofSchema);
