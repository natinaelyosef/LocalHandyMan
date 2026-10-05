import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, WorkerProfile, Booking } from "@/lib/models";
import { handle, ok, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";
import { notify } from "@/lib/services/notify";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAuth(["admin"]);
    const p = req.nextUrl.searchParams;
    const role = p.get("role") || "";
    const status = p.get("status") || "";
    const q = p.get("q")?.trim();
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(100, Number(p.get("limit") || 20));
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (status) filter.status = status;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const [items, total] = await Promise.all([
      User.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    const workerIds = items.filter((u) => u.role === "worker").map((u) => u._id);
    const profiles = await WorkerProfile.find({ userId: { $in: workerIds } }).lean();
    const profileMap = Object.fromEntries(profiles.map((pr) => [pr.userId.toString(), pr]));

    const counts = await User.aggregate([{ $group: { _id: { role: "$role", status: "$status" }, n: { $sum: 1 } } }]);

    return ok({
      items: items.map((u) => ({ ...u, workerProfile: profileMap[u._id.toString()] || null })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      counts,
    });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const body = await readJson<{ id?: string; status?: string; name?: string; role?: string; note?: string }>(req);
    if (!body.id) throw new ApiError("User id is required", 400);
    requireValidId(body.id);
    await connectDB();
    const user = await User.findById(body.id);
    if (!user) throw new ApiError("User not found", 404);
    if (body.status && !["active", "disabled", "suspended"].includes(body.status)) throw new ApiError("Invalid status", 400);

    if (body.status) user.status = body.status as never;
    if (body.name) user.name = body.name;
    if (body.role && ["customer", "worker", "admin"].includes(body.role)) user.role = body.role as never;
    await user.save();

    if (body.status === "suspended" && user.role === "worker") {
      await WorkerProfile.updateOne({ userId: user._id }, { status: "suspended", statusNote: body.note || "" });
    }

    await logAudit(session, "admin_user_updated", `User ${user.email} → status=${body.status || user.status}`, {
      entity: "User",
      entityId: user._id.toString(),
      meta: body,
    });
    await notify(user._id, {
      type: "account_status",
      title: `Account ${user.status}`,
      body: body.note || `Your account status is now ${user.status}.`,
      link:
        user.role === "worker"
          ? "/dashboard/worker"
          : user.role === "admin"
            ? "/dashboard/admin"
            : "/dashboard/customer",
      category: "system",
    });
    return ok({ user });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const { id } = await readJson<{ id?: string }>(req);
    if (!id) throw new ApiError("User id is required", 400);
    requireValidId(id);
    await connectDB();
    const active = await Booking.countDocuments({ customerId: id, status: { $nin: ["CLOSED", "CANCELLED", "REJECTED", "EXPIRED"] } });
    if (active > 0) throw new ApiError("User has active bookings and cannot be deleted", 409);
    const user = await User.findByIdAndDelete(id);
    if (!user) throw new ApiError("User not found", 404);
    await WorkerProfile.deleteOne({ userId: id });
    await logAudit(session, "admin_user_deleted", `User ${user.email} deleted`, { entity: "User", entityId: id });
    return ok({ deleted: true });
  });
}
