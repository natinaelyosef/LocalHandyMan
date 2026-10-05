import { NextRequest } from "next/server";
import { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { Notification } from "@/lib/models";
import { handle, ok, readJson } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const p = req.nextUrl.searchParams;
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Number(p.get("limit") || 20));
    const filter: Record<string, unknown> = { userId: session.sub };
    if (p.get("unread") === "1") filter.read = false;
    if (p.get("category")) filter.category = p.get("category");
    await connectDB();
    const [items, unread, total, grouped] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments({ userId: session.sub, read: false }),
      Notification.countDocuments({ userId: session.sub }),
      Notification.aggregate([
        // aggregate() does not cast the string session id to an ObjectId the
        // way .find() does, so it has to be converted explicitly.
        { $match: { userId: new Types.ObjectId(session.sub), read: false } },
        { $group: { _id: "$category", n: { $sum: 1 } } },
      ]),
    ]);
    return ok({
      items,
      unread,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      unreadByCategory: Object.fromEntries(grouped.map((s) => [s._id, s.n])),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const body = await readJson<{ action?: string; ids?: string[] }>(req);
    await connectDB();
    if (body.action === "read_all") {
      await Notification.updateMany({ userId: session.sub, read: false }, { read: true, readAt: new Date() });
      return ok({ updated: true });
    }
    if (body.action === "unread_all") {
      await Notification.updateMany({ userId: session.sub }, { read: false, readAt: null });
      return ok({ updated: true });
    }
    if (body.action === "read" && body.ids?.length) {
      await Notification.updateMany({ userId: session.sub, _id: { $in: body.ids } }, { read: true, readAt: new Date() });
      return ok({ updated: true });
    }
    if (body.action === "delete_all") {
      await Notification.deleteMany({ userId: session.sub, read: true });
      return ok({ deleted: true });
    }
    if (body.action === "delete" && body.ids?.length) {
      await Notification.deleteMany({ userId: session.sub, _id: { $in: body.ids } });
      return ok({ deleted: true });
    }
    return ok({ updated: false });
  });
}
