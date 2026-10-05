import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const ReviewSchema = new Schema(
  {
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    overall: { type: Number, required: true, min: 1, max: 5 },
    quality: { type: Number, default: 5, min: 1, max: 5 },
    communication: { type: Number, default: 5, min: 1, max: 5 },
    punctuality: { type: Number, default: 5, min: 1, max: 5 },
    professionalism: { type: Number, default: 5, min: 1, max: 5 },
    text: { type: String, default: "", maxlength: 2000 },
    photoFileIds: { type: [Schema.Types.ObjectId], ref: "FileAsset", default: [] },
    status: { type: String, enum: ["visible", "hidden", "removed"], default: "visible", index: true },
    workerReply: { type: String, default: "" },
    reported: { type: Boolean, default: false },
    reportReason: { type: String, default: "" },
  },
  { timestamps: true }
);

const FileAssetSchema = new Schema(
  {
    uploaderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: {
      type: String,
      enum: [
        "avatar",
        "worker_document",
        "portfolio",
        "request_media",
        "work_evidence",
        "payment_proof",
        "message",
        "review",
        "dispute_evidence",
      ],
      required: true,
      index: true,
    },
    originalName: { type: String, default: "file" },
    storedName: { type: String, required: true },
    mime: { type: String, required: true },
    size: { type: Number, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null, index: true },
  },
  { timestamps: true }
);

const AuditLogSchema = new Schema(
  {
    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    actorRole: { type: String, default: "" },
    actorName: { type: String, default: "" },
    action: { type: String, required: true, index: true },
    entity: { type: String, default: "", index: true },
    entityId: { type: String, default: "" },
    summary: { type: String, default: "" },
    meta: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

AuditLogSchema.index({ createdAt: -1 });

const FavoriteSchema = new Schema(
  {
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  },
  { timestamps: true }
);
FavoriteSchema.index({ customerId: 1, workerId: 1 }, { unique: true });

export type ReviewDoc = InferSchemaType<typeof ReviewSchema>;
export type FileAssetDoc = InferSchemaType<typeof FileAssetSchema>;
export type AuditLogDoc = InferSchemaType<typeof AuditLogSchema>;
export type FavoriteDoc = InferSchemaType<typeof FavoriteSchema>;

export const Review: Model<ReviewDoc> = models.Review || model("Review", ReviewSchema);
export const FileAsset: Model<FileAssetDoc> = models.FileAsset || model("FileAsset", FileAssetSchema);
export const AuditLog: Model<AuditLogDoc> = models.AuditLog || model("AuditLog", AuditLogSchema);
export const Favorite: Model<FavoriteDoc> = models.Favorite || model("Favorite", FavoriteSchema);
