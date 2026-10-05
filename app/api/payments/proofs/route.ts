import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { PaymentPhase, PaymentProof, Booking } from "@/lib/models";
import { handle, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { REJECT_REASONS } from "@/lib/constants";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAuth(["admin"]);
    const p = req.nextUrl.searchParams;
    const status = p.get("status") || "pending";
    const q = p.get("q")?.trim();
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Number(p.get("limit") || 15));
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (status !== "all") filter.status = status;
    if (q) {
      const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ reference: rx }, { senderName: rx }];
    }

    const [items, total] = await Promise.all([
      PaymentProof.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("customerId", "name email phone")
        .lean(),
      PaymentProof.countDocuments(filter),
    ]);

    const bookingIds = items.map((i) => i.bookingId);
    const bookings = await Booking.find({ _id: { $in: bookingIds } })
      .select("code title status customerId workerId")
      .populate("workerId", "name")
      .lean();
    const phaseIds = items.map((i) => i.paymentPhaseId);
    const phases = await PaymentPhase.find({ _id: { $in: phaseIds } })
      .select("label amount order bookingId")
      .lean();

    const bookingMap = Object.fromEntries(bookings.map((b) => [b._id.toString(), b]));
    const phaseMap = Object.fromEntries(phases.map((ph) => [ph._id.toString(), ph]));

    const enriched = items.map((proof) => ({
      ...proof,
      booking: bookingMap[proof.bookingId.toString()] || null,
      phase: phaseMap[proof.paymentPhaseId.toString()] || null,
    }));

    const counts = await PaymentProof.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]);

    return ok({
      items: enriched,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      counts: Object.fromEntries(counts.map((c) => [c._id, c.n])),
      rejectReasons: REJECT_REASONS,
    });
  });
}
