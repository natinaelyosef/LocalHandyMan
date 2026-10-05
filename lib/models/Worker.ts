import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { AVAILABILITY, PROFESSIONS, WORKER_STATUSES } from "../constants";

const PortfolioItemSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, default: "" },
    description: { type: String, default: "" },
    beforeFileId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    duringFileId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    afterFileId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    completedAt: { type: Date, default: null },
    area: { type: String, default: "" },
    status: { type: String, enum: ["draft", "published"], default: "published" },
  },
  { _id: true, timestamps: true }
);

const WorkerDocumentSchema = new Schema(
  {
    type: {
      type: String,
      enum: ["id", "skill_certificate", "training_certificate", "experience_evidence", "other"],
      required: true,
    },
    title: { type: String, required: true },
    fileId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewNote: { type: String, default: "" },
    reviewedAt: { type: Date, default: null },
  },
  { _id: true, timestamps: true }
);

const ScheduleSlotSchema = new Schema(
  {
    day: { type: String, enum: ["mon", "tue", "wed", "thu", "fri", "sat", "sun"], required: true },
    open: { type: String, default: "08:00" },
    close: { type: String, default: "17:00" },
    closed: { type: Boolean, default: false },
  },
  { _id: false }
);

/** A date range the worker has blocked out (holiday, illness, other commitments). */
const TimeOffSchema = new Schema(
  {
    from: { type: Date, required: true },
    to: { type: Date, required: true },
    reason: { type: String, default: "", trim: true, maxlength: 200 },
  },
  { _id: true, timestamps: true }
);

const WorkerProfileSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    profession: { type: String, required: true, enum: PROFESSIONS, index: true },
    headline: { type: String, default: "", trim: true },
    bio: { type: String, default: "", maxlength: 3000 },
    skills: { type: [String], default: [] },
    yearsOfExperience: { type: Number, default: 0, min: 0 },
    languages: { type: [String], default: ["Amharic", "English"] },
    startingPrice: { type: Number, default: 0, min: 0 },
    priceNote: { type: String, default: "Starting price per job" },
    categoryIds: { type: [Schema.Types.ObjectId], ref: "ServiceCategory", default: [], index: true },
    serviceArea: {
      region: { type: String, default: "" },
      city: { type: String, default: "" },
      woreda: { type: String, default: "" },
      radiusKm: { type: Number, default: 15, min: 1, max: 200 },
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
    },
    availability: { type: String, enum: AVAILABILITY, default: "available", index: true },
    emergencyAvailable: { type: Boolean, default: false, index: true },
    schedule: { type: [ScheduleSlotSchema], default: [] },
    timeOff: { type: [TimeOffSchema], default: [] },
    status: { type: String, enum: WORKER_STATUSES, default: "pending", index: true },
    statusNote: { type: String, default: "" },
    verifiedAt: { type: Date, default: null },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    documents: { type: [WorkerDocumentSchema], default: [] },
    portfolio: { type: [PortfolioItemSchema], default: [] },
    responseTimeMinutes: { type: Number, default: 30 },
    stats: {
      jobsCompleted: { type: Number, default: 0 },
      jobsCancelled: { type: Number, default: 0 },
      ratingSum: { type: Number, default: 0 },
      ratingCount: { type: Number, default: 0 },
    },
    featured: { type: Boolean, default: false },
    searchBoost: { type: Number, default: 0 },
  },
  { timestamps: true }
);

WorkerProfileSchema.index({ availability: 1, "serviceArea.city": 1, profession: 1 });
WorkerProfileSchema.index({ headline: "text", bio: "text", skills: "text", profession: "text" });

export type WorkerProfileDoc = InferSchemaType<typeof WorkerProfileSchema>;
export type PortfolioItem = InferSchemaType<typeof PortfolioItemSchema>;
export type WorkerDocument = InferSchemaType<typeof WorkerDocumentSchema>;

export const WorkerProfile: Model<WorkerProfileDoc> =
  models.WorkerProfile || model("WorkerProfile", WorkerProfileSchema);
