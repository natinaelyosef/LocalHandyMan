import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking, WorkerProfile } from "@/lib/models";
import { handle, ok } from "@/lib/http";
import { buildAvailability, parseDayKey, startOfDay } from "@/lib/services/availability";

export const dynamic = "force-dynamic";

/**
 * Public per-day availability for a worker. Callers are customers choosing a
 * date before requesting a service, so this is deliberately readable without a
 * session and never exposes booking ids or codes.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    const p = req.nextUrl.searchParams;
    const from = (p.get("from") ? parseDayKey(p.get("from") as string) : null) || startOfDay(new Date());
    const days = Math.min(62, Math.max(7, Number(p.get("days") || 30)));

    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: id })
      .select("schedule timeOff availability emergencyAvailable serviceArea profession")
      .lean();
    if (!profile) return ok({ workerId: id, available: false, days: [] });

    const bookings = await Booking.find({
      workerId: id,
      startDate: {
        $gte: from,
        $lte: new Date(from.getFullYear(), from.getMonth(), from.getDate() + days, 23, 59, 59, 999),
      },
    })
      .select("_id startDate status")
      .lean();

    const calendar = buildAvailability({
      from,
      days,
      schedule: profile.schedule,
      timeOff: profile.timeOff as never,
      bookings: bookings as never,
      availability: profile.availability,
      capacity: 1,
    }).map((d) => ({
      date: d.date,
      weekday: d.weekday,
      available: d.available,
      window: d.window,
      // expose only coarse reasons, never internal identifiers
      reasons: d.reasons.filter((r) => r !== "not_accepting"),
    }));

    return ok({
      workerId: id,
      availability: profile.availability,
      emergencyAvailable: profile.emergencyAvailable,
      serviceArea: profile.serviceArea,
      days: calendar,
      openDays: calendar.filter((d) => d.available).length,
    });
  });
}
