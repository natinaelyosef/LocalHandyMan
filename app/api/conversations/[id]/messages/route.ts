import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Conversation, Message } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { saveUpload } from "@/lib/services/files";
import { notify } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

async function loadAuthorized(convoId: string, userId: string, role: string) {
  await connectDB();
  const convo = await Conversation.findById(convoId);
  if (!convo) throw new ApiError("Conversation not found", 404);
  const isParticipant = convo.participants.some((p) => p.toString() === userId);
  if (!isParticipant && role !== "admin") throw new ApiError("Not authorized", 403);
  return convo;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);
    const convo = await loadAuthorized(id, session.sub, session.role);
    const p = req.nextUrl.searchParams;
    const before = p.get("before");
    const limit = Math.min(100, Number(p.get("limit") || 50));

    const query: Record<string, unknown> = { conversationId: id, deletedAt: null };
    if (before) query.createdAt = { $lt: new Date(before) };

    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(limit).lean();

    await Message.updateMany(
      { conversationId: id, senderId: { $ne: new Types.ObjectId(session.sub) }, readBy: { $ne: session.sub } },
      { $addToSet: { readBy: session.sub } }
    );
    convo.unread?.set(session.sub, 0);
    await convo.save();

    return ok({ messages: messages.reverse(), conversation: convo });
  });
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);
    const convo = await loadAuthorized(id, session.sub, session.role);
    if (convo.blockedBy.some((b) => b.toString() === session.sub)) throw new ApiError("Conversation is blocked", 403);

    const contentType = req.headers.get("content-type") || "";
    let message;

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const text = String(form.get("text") || "");
      const file = form.get("file");
      if (!file || typeof file === "string") throw new ApiError("File is required", 400);
      const asset = await saveUpload(file, session.sub, "message");
      asset.entityId = convo._id;
      await asset.save();
      const isImage = asset.mime.startsWith("image/");
      message = await Message.create({
        conversationId: id,
        senderId: session.sub,
        type: isImage ? "image" : "file",
        text,
        fileId: asset._id,
        readBy: [session.sub],
      });
    } else {
      const body = await readJson<{ text?: string; type?: string; location?: { latitude: number; longitude: number; label?: string } }>(req);
      const text = (body.text || "").trim();
      if (!text && !body.location) throw new ApiError("Message text is required", 400);
      message = await Message.create({
        conversationId: id,
        senderId: session.sub,
        type: body.location ? "location" : "text",
        text,
        location: body.location || undefined,
        readBy: [session.sub],
      });
    }

    convo.lastMessage = message.text || (message.type === "image" ? "📷 Photo" : message.type === "file" ? "📎 File" : "📍 Location");
    convo.lastMessageAt = message.createdAt;
    convo.lastSenderId = new Types.ObjectId(session.sub);
    for (const p of convo.participants) {
      if (p.toString() !== session.sub) {
        convo.unread = convo.unread || new Map();
        convo.unread.set(p.toString(), (convo.unread.get(p.toString()) || 0) + 1);
      }
    }
    await convo.save();

    const recipient = convo.participants.find((p) => p.toString() !== session.sub);
    if (recipient) {
      const recipientId = recipient.toString();
      const link =
        convo.workerId?.toString() === recipientId
          ? `/dashboard/worker/messages/${id}`
          : convo.customerId?.toString() === recipientId
            ? `/dashboard/customer/messages/${id}`
            : "/dashboard/admin";
      await notify(recipient, {
        type: "new_message",
        title: "New message",
        body: convo.lastMessage.slice(0, 120),
        link,
        category: "message",
      });
    }

    return ok({ message });
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ messageId?: string; action?: "edit" | "delete"; text?: string }>(req);
    if (!body.messageId) throw new ApiError("messageId is required", 400);
    await loadAuthorized(id, session.sub, session.role);
    const message = await Message.findById(body.messageId);
    if (!message) return fail("Message not found", 404);
    if (message.senderId.toString() !== session.sub) throw new ApiError("Not your message", 403);
    if (body.action === "delete") {
      message.deletedAt = new Date();
      message.text = "";
      await message.save();
      return ok({ deleted: true });
    }
    if (body.action === "edit") {
      message.text = (body.text || "").slice(0, 4000);
      message.editedAt = new Date();
      await message.save();
      return ok({ message });
    }
    throw new ApiError("Unknown action", 400);
  });
}
