import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WorkerProfile } from "@/lib/models";
import { handle, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAuth(["admin"]);
    const p = req.nextUrl.searchParams;
    const status = p.get("status") || "";
    const q = p.get("q")?.trim();
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Number(p.get("limit") || 15));
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;
    const professionRx = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : null;

    const pipeline = [
      ...(Object.keys(filter).length ? [{ $match: filter }] : []),
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { name: 1, email: 1, phone: 1, status: 1, createdAt: 1, avatarFileId: 1 } }],
        },
      },
      { $unwind: "$user" },
      ...(professionRx
        ? [{ $match: { $or: [{ profession: professionRx }, { headline: professionRx }, { skills: professionRx }, { "user.name": professionRx }] } }]
        : []),
      { $sort: { createdAt: -1 as const } },
      { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: "n" }] } },
    ];

    const agg = await WorkerProfile.aggregate(pipeline);
    const items = (agg[0]?.items || []) as Array<Record<string, unknown>>;
    const total = (agg[0]?.total?.[0]?.n as number) || 0;
    const counts = await WorkerProfile.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);

    return ok({ items, total, page, limit, pages: Math.ceil(total / limit), counts: Object.fromEntries(counts.map((c) => [c._id, c.n])) });
  });
}
