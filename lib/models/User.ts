import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";
import { ROLES } from "../constants";

export const AddressSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true, trim: true }, // Home, Office, Shop, Rental, Other
    region: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    woreda: { type: String, default: "", trim: true },
    subCity: { type: String, default: "", trim: true },
    area: { type: String, default: "", trim: true },
    street: { type: String, default: "", trim: true },
    latitude: { type: Number, default: null },
    longitude: { type: Number, default: null },
    notes: { type: String, default: "" },
    isDefault: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const UserSchema = new Schema(
  {
    role: { type: String, enum: ROLES, required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 2 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    gender: { type: String, enum: ["male", "female", "other", ""], default: "" },
    avatarFileId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    status: { type: String, enum: ["active", "disabled", "suspended"], default: "active", index: true },
    emailVerified: { type: Boolean, default: false },
    phoneVerified: { type: Boolean, default: false },
    loginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    preferredLanguage: { type: String, enum: ["en", "am", "om"], default: "en" },
    failedPaymentProofs: { type: Number, default: 0 },
    cancelledBookings: { type: Number, default: 0 },
    resetTokenHash: { type: String, default: null, select: false },
    resetExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;
export type AddressDoc = InferSchemaType<typeof AddressSchema>;

export const User: Model<UserDoc> = models.User || model("User", UserSchema);
export const Address: Model<AddressDoc> = models.Address || model("Address", AddressSchema);
