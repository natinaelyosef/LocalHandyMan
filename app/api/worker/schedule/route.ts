import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking, WorkerProfile } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/services/notify";
import {
  BLOCKING_BOOKING_STATUSES,
  buildAvailability,
  parseDayKey,
  startOfDay,
} from "@/lib/services/availability";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

type Slot = { day: string; open: string; close: string; closed: boolean };

function validTime(v: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

/**
 * GET  -> month/week calendar of confirmed jobs plus availability per day.
 * PATCH-> update the weekly working-hours template or add/remove time off.
 */
export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker", "admin"]);
    const p = req.nextUrl.searchParams;
    const fromKey = p.get("from") || "";
    const days = Math.min(62, Math.max(7, Number(p.get("days") || 31)));
    const from = (fromKey ? parseDayKey(fromKey) : null) || startOfDay(new Date());

    await connectDB();
    const filter =
      session.role === "admin" && p.get("workerId")
        ? { workerId: p.get("workerId") }
        : { workerId: session.sub };

    const [profile, bookings] = await Promise.all([
      WorkerProfile.findOne({ userId: filter.workerId })
        .select("schedule timeOff availability emergencyAvailable")
        .lean(),
      Booking.find({ ...filter, startDate: { $ne: null } })
        .select("_id code title status startDate scheduledTime expectedCompletion")
        .sort({ startDate: 1 })
        .lean(),
    ]);

    const relevant = bookings.filter(
      (b) => !b.status || (BLOCKING_BOOKING_STATUSES as readonly string[]).includes(b.status)
    );

    const calendar = buildAvailability({
      from,
      days,
      schedule: (profile?.schedule || []) as Slot[],
      timeOff: profile?.timeOff as never,
      bookings: relevant as never,
      availability: profile?.availability,
      capacity: 1,
    });

    return ok({
      calendar,
      schedule: profile?.schedule || [],
      timeOff: profile?.timeOff || [],
      availability: profile?.availability || "available",
      upcoming: bookings
        .filter((b) => b.startDate && new Date(b.startDate) >= startOfDay(new Date()))
        .slice(0, 20),
    });
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const body = await readJson<{
      schedule?: Slot[];
      timeOff?: { _id?: string; from?: string; to?: string; reason?: string }[];
      removeTimeOffId?: string;
    }>(req);

    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);

    if (body.schedule) {
      if (!Array.isArray(body.schedule)) throw new ApiError("schedule must be an array", 400);
      const clean: Slot[] = [];
      for (const raw of body.schedule) {
        const day = String(raw.day || "");
        if (!WEEKDAYS.includes(day as never)) throw new ApiError(`Invalid day: ${day}`, 400);
        const open = String(raw.open || "08:00");
        const close = String(raw.close || "17:00");
        if (!validTime(open) || !validTime(close)) throw new ApiError("Times must be HH:MM", 400);
        if (open >= close && !raw.closed) throw new ApiError("Closing time must be after opening time", 400);
        clean.push({ day, open, close, closed: raw.closed === true });
      }
      profile.schedule = clean as never;
    }

    if (Array.isArray(body.timeOff)) {
      const additions: { from: Date; to: Date; reason: string }[] = [];
      for (const t of body.timeOff) {
        const from = t.from ? parseDayKey(String(t.from).slice(0, 10)) : null;
        const to = t.to ? parseDayKey(String(t.to).slice(0, 10)) : from;
        if (!from || !to) throw new ApiError("timeOff entries need valid from/to dates", 400);
        if (to < from) throw new ApiError("timeOff 'to' must not be before 'from'", 400);
        additions.push({ from, to, reason: String(t.reason || "").slice(0, 200) });
      }
      if (additions.length) {
        for (const a of additions) profile.timeOff.push(a as never);
      }
    }

    if (body.removeTimeOffId) {
      const before = (profile.timeOff || []).length;
      profile.timeOff = ((profile.timeOff || []) as { _id: unknown }[]).filter(
        (t) => String(t._id) !== String(body.removeTimeOffId)
      ) as never;
      if (profile.timeOff.length === before) throw new ApiError("Time-off entry not found", 404);
    }

    await profile.save();

    return ok({ schedule: profile.schedule, timeOff: profile.timeOff });
  });
}

/** Reschedule a confirmed booking. Notifies the customer. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const body = await readJson<{ bookingId?: string; date?: string; time?: string }>(req);
    if (!body.bookingId) throw new ApiError("bookingId is required", 400);
    const d = body.date ? parseDayKey(String(body.date).slice(0, 10)) : null;
    if (!d) throw new ApiError("A valid date is required", 400);

    const time = String(body.time || "").trim();
    if (time && !validTime(time)) throw new ApiError("Time must be HH:MM", 400);

    await connectDB();
    const booking = await Booking.findById(body.bookingId);
    if (!booking) throw new ApiError("Booking not found", 404);
    if (booking.workerId.toString() !== session.sub) throw new ApiError("Not your booking", 403);
    if (["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED", "CANCELLED"].includes(booking.status)) {
      throw new ApiError("This booking can no longer be rescheduled", 409);
    }

    const clash = await Booking.findOne({
      _id: { $ne: booking._id },
      workerId: session.sub,
      status: { $in: [...BLOCKING_BOOKING_STATUSES] },
      startDate: {
        $gte: d,
        $lte: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999),
      },
    });
    if (clash) {
      throw new ApiError(`You already have booking ${clash.code} on that date`, 409);
    }

    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (profile?.timeOff?.length) {
      const blocked = (profile.timeOff as unknown as { from: Date; to: Date }[]).some(
        (t) => new Date(t.from) <= d && new Date(t.to) >= d
      );
      if (blocked) throw new ApiError("You have marked that date as time off", 409);
    }

    const previous = booking.startDate;
    booking.startDate = d;
    booking.scheduledTime = time;
    booking.timeline.push({
      at: new Date(),
      action: "booking_rescheduled",
      actorRole: session.role,
      note: `${previous ? new Date(previous).toISOString().slice(0, 10) : "unset"} → ${d.toISOString().slice(0, 10)}`,
      from: previous ? new Date(previous).toISOString().slice(0, 10) : "",
      to: d.toISOString().slice(0, 10),
      actorId: null,
    } as never);
    await booking.save();

    await notify(booking.customerId, {
      type: "booking_rescheduled",
      title: "Your job was rescheduled",
      body: `${booking.code} is now set for ${d.toISOString().slice(0, 10)}${time ? ` at ${time}` : ""}.`,
      link: `/dashboard/customer/bookings/${booking._id}`,
      category: "booking",
    });

    return ok({ booking });
  });
}
