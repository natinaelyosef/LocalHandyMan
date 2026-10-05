import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking } from "@/lib/models";
import { handle, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const p = req.nextUrl.searchParams;
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Number(p.get("limit") || 10));
    const status = p.get("status");
    const q = p.get("q")?.trim();
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (session.role === "customer") filter.customerId = session.sub;
    else if (session.role === "worker") filter.workerId = session.sub;
    else if (p.get("all") !== "1" && session.role === "admin") {
      if (p.get("customerId")) filter.customerId = p.get("customerId");
      if (p.get("workerId")) filter.workerId = p.get("workerId");
    }

    if (status) {
      filter.status = status.includes(",")
        ? { $in: status.split(",") }
        : status;
    }
    if (q) {
      filter.$or = [
        { code: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
        { title: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") },
      ];
    }

    const [items, total] = await Promise.all([
      Booking.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customerId", "name phone avatarFileId")
        .populate("workerId", "name phone avatarFileId")
        .populate("categoryId", "name slug")
        .lean(),
      Booking.countDocuments(filter),
    ]);

    const statusCounts = await Booking.aggregate([
      { $match: session.role === "customer" ? { customerId: session.sub } : session.role === "worker" ? { workerId: session.sub } : {} },
      { $group: { _id: "$status", n: { $sum: 1 } } },
    ]);

    return ok({
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id, s.n])),
    });
  });
}
