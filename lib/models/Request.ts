import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { URGENCY } from "../constants";

const LocationSnapshotSchema = new Schema(
  {
    addressId: { type: Schema.Types.ObjectId, ref: "Address", default: null },
    label: { type: String, default: "" },
    region: { type: String, default: "" },
    city: { type: String, default: "" },
    woreda: { type: String, default: "" },
    subCity: { type: String, default: "" },
    area: { type: String, default: "" },
    street: { type: String, default: "" },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    instructions: { type: String, default: "" },
  },
  { _id: false }
);

const ServiceRequestSchema = new Schema(
  {
    reference: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    categoryId: { type: Schema.Types.ObjectId, ref: "ServiceCategory", required: true, index: true },
    subCategoryId: { type: Schema.Types.ObjectId, ref: "ServiceCategory", default: null },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true, maxlength: 5000 },
    urgency: { type: String, enum: URGENCY, default: "normal", index: true },
    location: { type: LocationSnapshotSchema, default: () => ({}) },
    mediaFileIds: { type: [Schema.Types.ObjectId], ref: "FileAsset", default: [] },
    measurements: { type: String, default: "" },
    requiredMaterials: { type: String, default: "" },
    accessInstructions: { type: String, default: "" },
    specialInstructions: { type: String, default: "" },
    preferredDate: { type: Date, default: null },
    preferredTime: { type: String, default: "" },
    budget: { type: Number, default: 0, min: 0 },
    status: {
      type: String,
      enum: ["open", "quoted", "booking_created", "cancelled", "expired"],
      default: "open",
      index: true,
    },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    invitedWorkerIds: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    expiresAt: { type: Date, default: null, index: true },
    preferredWorkerId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    recurring: {
      enabled: { type: Boolean, default: false },
      interval: { type: String, enum: ["none", "weekly", "monthly", "quarterly"], default: "none" },
    },
  },
  { timestamps: true }
);

ServiceRequestSchema.index({ title: "text", description: "text" });

const QuotationSchema = new Schema(
  {
    requestId: { type: Schema.Types.ObjectId, ref: "ServiceRequest", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    laborCost: { type: Number, required: true, min: 0 },
    materialsCost: { type: Number, default: 0, min: 0 },
    transportCost: { type: Number, default: 0, min: 0 },
    otherCost: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    estimatedDuration: { type: String, default: "" },
    proposedStartDate: { type: Date, default: null },
    proposedEndDate: { type: Date, default: null },
    warrantyDays: { type: Number, default: 0, min: 0 },
    paymentPlan: {
      type: [
        {
          label: { type: String, required: true },
          percent: { type: Number, required: true, min: 1, max: 100 },
          _id: false,
        },
      ],
      default: [],
    },
    notes: { type: String, default: "", maxlength: 3000 },
    status: {
      type: String,
      enum: ["pending", "accepted", "rejected", "withdrawn", "changes_requested"],
      default: "pending",
      index: true,
    },
    customerNote: { type: String, default: "" },
    respondedAt: { type: Date, default: null },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null },
    responseMinutes: { type: Number, default: null },
    // "accept" = created by the one-click Accept action (FR-QUOTE-07)
    source: { type: String, enum: ["quotation", "accept"], default: "quotation" },
  },
  { timestamps: true }
);

export type ServiceRequestDoc = InferSchemaType<typeof ServiceRequestSchema>;
export type QuotationDoc = InferSchemaType<typeof QuotationSchema>;
export type LocationSnapshot = InferSchemaType<typeof LocationSnapshotSchema>;
export { LocationSnapshotSchema };

export const ServiceRequest: Model<ServiceRequestDoc> =
  models.ServiceRequest || model("ServiceRequest", ServiceRequestSchema);
export const Quotation: Model<QuotationDoc> = models.Quotation || model("Quotation", QuotationSchema);
