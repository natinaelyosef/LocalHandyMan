import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { AuditLog } from "@/lib/models";
import { handle, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAuth(["admin"]);
    const p = req.nextUrl.searchParams;
    const action = p.get("action") || "";
    const q = p.get("q")?.trim();
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(100, Number(p.get("limit") || 30));
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ summary: rx }, { actorName: rx }, { entityId: rx }];
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);
    const actions = await AuditLog.distinct("action");

    return ok({ items, total, page, limit, pages: Math.ceil(total / limit), actions });
  });
}
