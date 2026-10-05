import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { Booking, JobPhase } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { buildTimelineEntry } from "@/lib/models/Booking";
import { notify } from "@/lib/services/notify";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["worker", "admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ name?: string; description?: string; amount?: number; dueDate?: string }>(req);
    if (!body.name) throw new ApiError("Phase name is required", 400);

    await connectDB();
    const booking = await Booking.findById(id);
    if (!booking) return fail("Booking not found", 404);
    if (session.role !== "admin" && booking.workerId.toString() !== session.sub) {
      return fail("Not your booking", 403);
    }

    const count = await JobPhase.countDocuments({ bookingId: id });
    const phase = await JobPhase.create({
      bookingId: id,
      order: count + 1,
      name: body.name,
      description: body.description || "",
      amount: Number(body.amount || 0),
      dueDate: body.dueDate ? new Date(body.dueDate) : null,
      status: "NOT_STARTED",
    });

    booking.jobPhaseIds.push(phase._id as never);
    booking.timeline.push(
      buildTimelineEntry("job_phase_added", {
        actorId: new mongoose.Types.ObjectId(session.sub),
        actorRole: session.role,
        note: `Added work phase: ${phase.name}`,
      }) as never
    );
    await booking.save();
    return ok({ phase });
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["worker", "admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{
      status?: string;
      percent?: number;
      notes?: string;
      amount?: number;
      dueDate?: string;
      name?: string;
      description?: string;
      evidence?: { before?: string[]; during?: string[]; after?: string[] };
      removeEvidence?: { kind: "before" | "during" | "after"; fileId: string };
    }>(req);

    await connectDB();
    const phase = await JobPhase.findById(id);
    if (!phase) return fail("Phase not found", 404);
    const booking = await Booking.findById(phase.bookingId);
    if (!booking) return fail("Booking not found", 404);
    if (session.role !== "admin" && booking.workerId.toString() !== session.sub) {
      return fail("Not your booking", 403);
    }

    if (body.status) {
      const valid = ["NOT_STARTED", "IN_PROGRESS", "AWAITING_CUSTOMER", "COMPLETED", "CANCELLED"];
      if (!valid.includes(body.status)) throw new ApiError("Invalid phase status", 400);
      if (body.status === "IN_PROGRESS" && !phase.startedAt) phase.startedAt = new Date();
      if (body.status === "COMPLETED") {
        phase.completedAt = new Date();
        phase.percent = 100;
      }
      phase.status = body.status as never;
    }
    if (typeof body.percent === "number") phase.percent = Math.max(0, Math.min(100, body.percent));
    if (body.notes !== undefined) phase.notes = body.notes;
    if (body.amount !== undefined) phase.amount = Number(body.amount);
    if (body.name) phase.name = body.name;
    if (body.description !== undefined) phase.description = body.description;
    if (body.dueDate) phase.dueDate = new Date(body.dueDate);

    if (body.evidence) {
      for (const kind of ["before", "during", "after"] as const) {
        const files = body.evidence[kind];
        if (files && files.length) {
          const current = (phase.evidence?.[kind] as unknown[]) || [];
          (phase.evidence as never as Record<string, unknown[]>)[kind] = [...current, ...files].slice(-10);
        }
      }
    }
    if (body.removeEvidence) {
      const { kind, fileId } = body.removeEvidence;
      const current = (phase.evidence?.[kind] as unknown[]) || [];
      (phase.evidence as never as Record<string, unknown[]>)[kind] = current.filter((f) => String(f) !== fileId);
    }

    await phase.save();

    const phases = await JobPhase.find({ bookingId: booking._id }).sort({ order: 1 }).lean();
    const done = phases.filter((p) => p.status === "COMPLETED").length;
    const computed = phases.length ? Math.round((done / phases.length) * 100) : 0;
    booking.progressPercent = Math.max(computed, phase.percent === 100 ? computed : computed);

    if (body.status) {
      booking.timeline.push(
        buildTimelineEntry("job_phase_updated", {
          actorId: new mongoose.Types.ObjectId(session.sub),
          actorRole: session.role,
          note: `${phase.name}: ${body.status}`,
        }) as never
      );
      await notify(booking.customerId, {
        type: "phase_update",
        title: "Work phase updated",
        body: `${phase.name} → ${String(body.status).replace(/_/g, " ").toLowerCase()}`,
        link: `/dashboard/customer/bookings/${booking._id}`,
        category: "booking",
      });
    }
    await booking.save();
    return ok({ phase, progressPercent: booking.progressPercent });
  });
}
