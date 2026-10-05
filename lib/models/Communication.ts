import { Schema, model, models, type Model, type InferSchemaType } from "mongoose";

const ConversationSchema = new Schema(
  {
    participants: { type: [Schema.Types.ObjectId], ref: "User", required: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    workerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    bookingId: { type: Schema.Types.ObjectId, ref: "Booking", default: null, index: true },
    lastMessage: { type: String, default: "" },
    lastMessageAt: { type: Date, default: null },
    lastSenderId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    unread: { type: Map, of: Number, default: {} },
    blockedBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
  },
  { timestamps: true }
);

ConversationSchema.index({ participants: 1, bookingId: 1 });

const MessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "Conversation", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["text", "image", "file", "location"], default: "text" },
    text: { type: String, default: "" },
    fileId: { type: Schema.Types.ObjectId, ref: "FileAsset", default: null },
    location: {
      latitude: { type: Number, default: null },
      longitude: { type: Number, default: null },
      label: { type: String, default: "" },
    },
    readBy: { type: [Schema.Types.ObjectId], ref: "User", default: [] },
    editedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

MessageSchema.index({ conversationId: 1, createdAt: -1 });

const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: "" },
    link: { type: String, default: "" },
    category: {
      type: String,
      enum: ["booking", "payment", "message", "review", "worker", "system"],
      default: "system",
      index: true,
    },
    read: { type: Boolean, default: false, index: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

NotificationSchema.index({ userId: 1, createdAt: -1 });

export type ConversationDoc = InferSchemaType<typeof ConversationSchema>;
export type MessageDoc = InferSchemaType<typeof MessageSchema>;
export type NotificationDoc = InferSchemaType<typeof NotificationSchema>;

export const Conversation: Model<ConversationDoc> =
  models.Conversation || model("Conversation", ConversationSchema);
export const Message: Model<MessageDoc> = models.Message || model("Message", MessageSchema);
export const Notification: Model<NotificationDoc> =
  models.Notification || model("Notification", NotificationSchema);
