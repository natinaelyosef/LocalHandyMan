import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Conversation, Message, User, Booking } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { ensureConversation } from "@/lib/services/booking";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireAuth();
    await connectDB();
    const filter =
      session.role === "admin"
        ? {}
        : session.role === "worker"
          ? { workerId: session.sub }
          : { customerId: session.sub };

    const convos = await Conversation.find(filter)
      .sort({ lastMessageAt: -1 })
      .populate("customerId", "name avatarFileId")
      .populate("workerId", "name avatarFileId")
      .populate("bookingId", "code title status")
      .lean();

    const unread = await Message.aggregate([
      {
        $match: {
          conversationId: { $in: convos.map((c) => c._id) },
          senderId: { $ne: new Types.ObjectId(session.sub) },
          readBy: { $ne: session.sub },
        },
      },
      { $group: { _id: "$conversationId", n: { $sum: 1 } } },
    ]);
    const unreadMap = Object.fromEntries(unread.map((u) => [u._id.toString(), u.n]));

    return ok({
      conversations: convos.map((c) => ({
        ...c,
        unreadCount: unreadMap[c._id.toString()] || 0,
        otherUser: session.role === "worker" ? c.customerId : c.workerId,
      })),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["customer", "worker", "admin"]);
    const body = await readJson<{ workerId?: string; customerId?: string; bookingId?: string }>(req);
    await connectDB();

    const bookingId = body.bookingId ? new Types.ObjectId(body.bookingId) : undefined;

    const respond = async (convoId: Types.ObjectId) => {
      const full = await Conversation.findById(convoId)
        .populate("workerId", "name avatarFileId")
        .populate("customerId", "name avatarFileId");
      return ok({ conversation: full });
    };

    let pair: { customerId: string; workerId: string };

    if (session.role === "worker") {
      // FR-MSG-05: a provider can open a pre-acceptance thread with a homeowner.
      if (body.customerId) {
        if (body.customerId === session.sub) throw new ApiError("Cannot message yourself", 400);
        const customer = await User.findOne({ _id: body.customerId, role: "customer" });
        if (!customer) throw new ApiError("Customer not found", 404);
        pair = { customerId: body.customerId, workerId: session.sub };
      } else {
        // Backward compatible: legacy { workerId: ownId } returns the worker's newest thread.
        if (body.workerId && body.workerId !== session.sub) {
          throw new ApiError("Workers can only open their own conversations", 403);
        }
        const convo = await Conversation.findOne({ workerId: session.sub }).sort({ lastMessageAt: -1 });
        if (convo) return ok({ conversation: convo });
        throw new ApiError("No conversation found yet", 404);
      }
    } else if (session.role === "admin") {
      // FIX: an admin must name both parties (previously the admin became "customer").
      if (!body.customerId || !body.workerId) {
        throw new ApiError("customerId and workerId are required", 400);
      }
      pair = { customerId: body.customerId, workerId: body.workerId };
    } else {
      // customer
      if (!body.workerId) throw new ApiError("workerId is required", 400);
      if (body.workerId === session.sub) throw new ApiError("Cannot message yourself", 400);
      const worker = await User.findOne({ _id: body.workerId, role: "worker" });
      if (!worker) throw new ApiError("Worker not found", 404);
      pair = { customerId: session.sub, workerId: body.workerId };
    }

    if (bookingId) {
      const booking = await Booking.findById(bookingId).select("customerId workerId").lean();
      if (
        !booking ||
        booking.customerId.toString() !== pair.customerId ||
        booking.workerId.toString() !== pair.workerId
      ) {
        throw new ApiError("Booking not found for this conversation", 404);
      }
    }

    return respond(await ensureConversation(pair.customerId, pair.workerId, bookingId));
  });
}
