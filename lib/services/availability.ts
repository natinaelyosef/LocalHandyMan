import type { Types } from "mongoose";

export type ScheduleSlot = { day: string; open: string; close: string; closed: boolean };

export type TimeOffRange = { _id?: unknown; from: Date | string; to: Date | string; reason?: string };

/** Booking statuses that still occupy a slot on the worker's calendar. */
export const BLOCKING_BOOKING_STATUSES = [
  "BOOKING_CONFIRMED",
  "ADVANCE_PAYMENT_DUE",
  "PAYMENT_PROOF_SUBMITTED",
  "PAYMENT_VERIFIED",
  "SCHEDULED",
  "WORKER_ON_THE_WAY",
  "WORK_STARTED",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "READY_FOR_REVIEW",
  "COMPLETED",
  "CUSTOMER_CONFIRMED",
  "DISPUTED",
] as const;

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

/** `YYYY-MM-DD` in local time (never UTC — a day boundary must not shift). */
export function dayKey(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function endOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

/** The `ScheduleSlot` for a weekday, falling back to Mon–Fri when unset. */
export function slotForDay(schedule: ScheduleSlot[] | undefined, d: Date): ScheduleSlot {
  const key = DAY_KEYS[d.getDay()] as DayKey;
  const found = (schedule || []).find((s) => s.day === key);
  if (found) return found;
  const fallbackOpen = key !== "sun";
  return { day: key, open: "08:00", close: "17:00", closed: !fallbackOpen };
}

export function isBlockedByTimeOff(timeOff: TimeOffRange[] | undefined, d: Date): boolean {
  if (!timeOff || timeOff.length === 0) return false;
  const dayStart = startOfDay(d).getTime();
  const dayEnd = endOfDay(d).getTime();
  return timeOff.some((t) => {
    const from = new Date(t.from).getTime();
    const to = new Date(t.to).getTime();
    if (isNaN(from) || isNaN(to)) return false;
    return from <= dayEnd && to >= dayStart;
  });
}

export type BusyBooking = {
  _id: Types.ObjectId | string;
  startDate?: Date | string | null;
  expectedCompletion?: Date | string | null;
  code?: string;
  title?: string;
  status?: string;
};

export type DayAvailability = {
  date: string;
  weekday: DayKey;
  available: boolean;
  reasons: string[];
  bookings: { _id: string; code?: string; title?: string; status?: string; time?: string }[];
  window?: { open: string; close: string };
};

/**
 * Builds a per-day availability map for a window of dates. A day is available
 * when the weekly schedule is open, no time-off range overlaps it, the worker
 * is not marked offline, and no blocking booking already sits on it.
 *
 * `capacity` lets a worker accept more than one job per day.
 */
export function buildAvailability(opts: {
  from: Date;
  days: number;
  schedule?: ScheduleSlot[];
  timeOff?: TimeOffRange[];
  bookings: BusyBooking[];
  availability?: string;
  capacity?: number;
}): DayAvailability[] {
  const { from, days, schedule, timeOff, bookings, availability = "available", capacity = 1 } = opts;
  const out: DayAvailability[] = [];
  const takeDatesOnly = availability === "available" || availability === "busy";

  const byDay = new Map<string, BusyBooking[]>();
  for (const b of bookings) {
    if (!b.startDate) continue;
    const d = new Date(b.startDate);
    if (isNaN(d.getTime())) continue;
    const key = dayKey(d);
    const list = byDay.get(key) || [];
    list.push(b);
    byDay.set(key, list);
  }

  const start = startOfDay(from);
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const reasons: string[] = [];
    const slot = slotForDay(schedule, d);
    const dayBookings = (byDay.get(dayKey(d)) || []).map((b) => ({
      _id: String(b._id),
      code: b.code,
      title: b.title,
      status: b.status,
      time: undefined as string | undefined,
    }));

    if (slot.closed) reasons.push("closed_day");
    if (isBlockedByTimeOff(timeOff, d)) reasons.push("time_off");
    if (dayBookings.length >= capacity) reasons.push("fully_booked");
    if (!takeDatesOnly) reasons.push("not_accepting");

    out.push({
      date: dayKey(d),
      weekday: DAY_KEYS[d.getDay()] as DayKey,
      available: reasons.length === 0,
      reasons,
      bookings: dayBookings,
      window: slot.closed ? undefined : { open: slot.open, close: slot.close },
    });
  }
  return out;
}

/** Parses `YYYY-MM-DD` as a local midnight date (not UTC). */
export function parseDayKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}
