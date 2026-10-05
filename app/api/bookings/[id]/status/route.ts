import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking, PaymentPhase } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { advanceStatus, recomputePaymentSummary } from "@/lib/services/booking";
import { notify } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";
import type { BookingStatus } from "@/lib/constants";

const WORKER_ACTIONS: BookingStatus[] = [
  "SCHEDULED",
  "WORKER_ON_THE_WAY",
  "WORK_STARTED",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "READY_FOR_REVIEW",
  "COMPLETED",
  "DISPUTED",
  "CANCELLED",
];
const CUSTOMER_ACTIONS: BookingStatus[] = ["CUSTOMER_CONFIRMED", "CLOSED", "DISPUTED", "CANCELLED"];

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ status?: BookingStatus; note?: string; progressPercent?: number; reason?: string }>(req);
    const target = body.status;
    if (!target) throw new ApiError("Target status is required", 400);

    await connectDB();
    const booking = await Booking.findById(id);
    if (!booking) return fail("Booking not found", 404);

    const isCustomer = booking.customerId.toString() === session.sub;
    const isWorker = booking.workerId.toString() === session.sub;
    const isAdmin = session.role === "admin";
    if (!isCustomer && !isWorker && !isAdmin) return fail("Not authorized", 403);

    if (!isAdmin) {
      const allowed = isWorker ? WORKER_ACTIONS : CUSTOMER_ACTIONS;
      if (!allowed.includes(target)) throw new ApiError(`Role cannot perform "${target}"`, 403);
    }

    if (target === "WORK_STARTED" && !isAdmin) {
      const first = await PaymentPhase.findOne({ bookingId: id }).sort({ order: 1 });
      if (first && first.status !== "VERIFIED") {
        throw new ApiError(
          "Work cannot start until the advance payment phase is verified by the platform.",
          409
        );
      }
    }

    if ((target === "CANCELLED" || target === "DISPUTED") && !body.reason && !isAdmin) {
      throw new ApiError("A reason is required", 400);
    }

    const updated = await advanceStatus(id, target, session, {
      note: body.reason || body.note || "",
    });

    if (typeof body.progressPercent === "number") {
      updated.progressPercent = Math.max(0, Math.min(100, body.progressPercent));
      await updated.save();
    }

    if (target === "CANCELLED") {
      if (isCustomer) {
        updated.cancelledBy = "customer";
        await updated.save();
      } else if (isWorker) {
        updated.cancelledBy = "worker";
        await updated.save();
      }
      const counterparty = isCustomer ? updated.workerId : updated.customerId;
      await notify(counterparty, {
        type: "booking_cancelled",
        title: "Booking cancelled",
        body: `Booking ${updated.code} was cancelled. Reason: ${body.reason || body.note || "n/a"}`,
        link: isCustomer ? "/dashboard/worker/jobs" : `/dashboard/customer/bookings/${id}`,
        category: "booking",
      });
    }

    if (target === "COMPLETED") {
      await notify(updated.customerId, {
        type: "job_completed",
        title: "Worker marked the job as completed",
        body: `Please review the work for booking ${updated.code} and confirm completion.`,
        link: `/dashboard/customer/bookings/${id}`,
        category: "booking",
      });
    }

    if (target === "CUSTOMER_CONFIRMED") {
      await notify(updated.workerId, {
        type: "job_confirmed",
        title: "Customer confirmed completion",
        body: `Booking ${updated.code} was confirmed by the customer.`,
        link: `/dashboard/worker/jobs/${id}`,
        category: "booking",
      });
      await advanceStatus(id, "CLOSED", session, { note: "Auto-closed after customer confirmation" });
    }

    if (target === "WORKER_ON_THE_WAY" || target === "WORK_STARTED") {
      await notify(updated.customerId, {
        type: "worker_update",
        title: target === "WORKER_ON_THE_WAY" ? "Worker is on the way" : "Work started",
        body: `Booking ${updated.code}: ${target === "WORKER_ON_THE_WAY" ? "Your worker is on the way." : "Your worker has started the job."}`,
        link: `/dashboard/customer/bookings/${id}`,
        category: "booking",
      });
    }

    await recomputePaymentSummary(id);
    await logAudit(session, "booking_status_changed", `Booking ${updated.code}: ${target}`, {
      entity: "Booking",
      entityId: id,
      meta: { note: body.reason || body.note || "" },
    });

    const fresh = await Booking.findById(id).lean();
    return ok({ booking: fresh });
  });
}
