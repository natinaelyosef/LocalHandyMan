import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { JobPhase, Booking } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/services/notify";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["customer", "admin"]);
    const body = await readJson<{ phaseId?: string; note?: string; approve?: boolean }>(req);
    if (!body.phaseId) throw new ApiError("Phase id is required", 400);
    await connectDB();
    const phase = await JobPhase.findById(body.phaseId);
    if (!phase) throw new ApiError("Phase not found", 404);
    const booking = await Booking.findById(phase.bookingId);
    if (!booking) throw new ApiError("Booking not found", 404);
    if (session.role !== "admin" && booking.customerId.toString() !== session.sub) {
      throw new ApiError("Not your booking", 403);
    }
    if (body.approve === false) {
      phase.status = "IN_PROGRESS";
      phase.notes = `${phase.notes}\n[Customer] ${body.note || "Requested changes"}`.trim();
      await phase.save();
      await notify(booking.workerId, {
        type: "phase_changes",
        title: "Customer requested changes",
        body: `${phase.name}: ${body.note || ""}`,
        link: `/dashboard/worker/jobs/${booking._id}`,
        category: "booking",
      });
      return ok({ phase });
    }
    phase.status = "COMPLETED";
    phase.completedAt = new Date();
    phase.percent = 100;
    phase.notes = `${phase.notes}\n[Customer] ${body.note || "Approved"}`.trim();
    await phase.save();
    await notify(booking.workerId, {
      type: "phase_approved",
      title: "Phase approved by customer",
      body: `${phase.name} approved.`,
      link: `/dashboard/worker/jobs/${booking._id}`,
      category: "booking",
    });
    return ok({ phase });
  });
}
