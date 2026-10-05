import { connectDB } from "../db";
import { Notification } from "../models";
import type { Types } from "mongoose";

export type NotificationCategory = "booking" | "payment" | "message" | "review" | "worker" | "system";

export async function notify(
  userId: string | Types.ObjectId,
  input: { type: string; title: string; body?: string; link?: string; category?: NotificationCategory }
) {
  try {
    await connectDB();
    await Notification.create({
      userId,
      type: input.type,
      title: input.title,
      body: input.body ?? "",
      link: input.link ?? "",
      category: input.category ?? "system",
    });
  } catch (err) {
    console.error("[notify]", err);
  }
}

export async function notifyMany(
  userIds: (string | Types.ObjectId)[],
  input: { type: string; title: string; body?: string; link?: string; category?: NotificationCategory }
) {
  if (!userIds.length) return;
  try {
    await connectDB();
    await Notification.insertMany(
      userIds.map((userId) => ({
        userId,
        type: input.type,
        title: input.title,
        body: input.body ?? "",
        link: input.link ?? "",
        category: input.category ?? "system",
      }))
    );
  } catch (err) {
    console.error("[notifyMany]", err);
  }
}
