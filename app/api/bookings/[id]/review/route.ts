import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking, Review, WorkerProfile } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["customer"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{
      overall?: number;
      quality?: number;
      communication?: number;
      punctuality?: number;
      professionalism?: number;
      text?: string;
    }>(req);

    const overall = Number(body.overall || 0);
    if (overall < 1 || overall > 5) throw new ApiError("Overall rating (1-5) is required", 400);

    await connectDB();
    const booking = await Booking.findById(id);
    if (!booking) return fail("Booking not found", 404);
    if (booking.customerId.toString() !== session.sub) return fail("Not your booking", 403);
    if (!["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"].includes(booking.status)) {
      throw new ApiError("You can only review a completed booking", 409);
    }
    if (booking.reviewed) throw new ApiError("This booking was already reviewed", 409);

    const existing = await Review.findOne({ bookingId: id });
    if (existing) throw new ApiError("This booking was already reviewed", 409);

    const review = await Review.create({
      bookingId: id,
      workerId: booking.workerId,
      customerId: session.sub,
      overall,
      quality: Number(body.quality || overall),
      communication: Number(body.communication || overall),
      punctuality: Number(body.punctuality || overall),
      professionalism: Number(body.professionalism || overall),
      text: (body.text || "").slice(0, 2000),
    });

    const profile = await WorkerProfile.findOne({ userId: booking.workerId });
    if (profile) {
      profile.stats = profile.stats || { jobsCompleted: 0, jobsCancelled: 0, ratingSum: 0, ratingCount: 0 };
      profile.stats.ratingSum = (profile.stats.ratingSum || 0) + overall;
      profile.stats.ratingCount = (profile.stats.ratingCount || 0) + 1;
      await profile.save();
    }

    booking.reviewed = true;
    await booking.save();

    await notify(booking.workerId, {
      type: "review_received",
      title: `${overall}-star review received`,
      body: (body.text || "").slice(0, 140) || `Customer rated your work on booking ${booking.code}.`,
      link: "/dashboard/worker/reviews",
      category: "review",
    });
    await logAudit(session, "review_created", `Review ${overall}★ for booking ${booking.code}`, {
      entity: "Review",
      entityId: review._id.toString(),
    });

    return ok({ review });
  });
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const p = req.nextUrl.searchParams;
    const workerId = p.get("workerId");
    await connectDB();
    const filter: Record<string, unknown> = { status: "visible" };
    if (workerId) filter.workerId = workerId;
    const reviews = await Review.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("customerId", "name avatarFileId")
      .lean();
    return ok({ reviews });
  });
}
