import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Booking, Dispute, User } from "@/lib/models";
import { handle, ok, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { COMPLAINT_CATEGORIES, DISPUTABLE_BOOKING_STATUSES, OPEN_DISPUTE_STATUSES } from "@/lib/constants";
import { buildDisputeTimelineEntry } from "@/lib/models/Dispute";
import { notify, notifyMany } from "@/lib/services/notify";
import { disputeInboxLink } from "@/lib/services/disputes";
import { logAudit } from "@/lib/services/audit";
import { saveUpload } from "@/lib/services/files";
import mongoose from "mongoose";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function newCode() {
  return `DS${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const p = req.nextUrl.searchParams;
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Number(p.get("limit") || 10));
    const status = p.get("status")?.trim();
    const bookingId = p.get("bookingId")?.trim();
    const q = p.get("q")?.trim();

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (session.role === "customer") filter.raisedBy = session.sub;
    else if (session.role === "worker") {
      // A worker sees cases they raised *and* cases raised against them.
      filter.$or = [{ raisedBy: session.sub }, { againstUserId: session.sub }];
    }

    if (status === "open") filter.status = { $in: OPEN_DISPUTE_STATUSES };
    else if (status) {
      filter.status = status.includes(",") ? { $in: status.split(",") } : status;
    }
    if (bookingId) {
      requireValidId(bookingId);
      filter.bookingId = bookingId;
    }
    if (q) {
      const rx = new RegExp(esc(q), "i");
      filter.$or = filter.$or
        ? [{ $or: filter.$or }, { code: rx }, { subject: rx }]
        : [{ code: rx }, { subject: rx }];
    }

    const self = new mongoose.Types.ObjectId(session.sub);
    const scopeForCounts: Record<string, unknown> =
      session.role === "customer"
        ? { raisedBy: self }
        : session.role === "worker"
          ? { $or: [{ raisedBy: self }, { againstUserId: self }] }
          : {};

    const [items, total, grouped, openCount] = await Promise.all([
      Dispute.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("raisedBy", "name phone avatarFileId role")
        .populate("againstUserId", "name phone avatarFileId role")
        .populate("assignedTo", "name")
        .populate("bookingId", "code title status agreedTotal")
        .lean(),
      Dispute.countDocuments(filter),
      Dispute.aggregate([
        { $match: scopeForCounts },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      Dispute.countDocuments({ ...scopeForCounts, status: { $in: OPEN_DISPUTE_STATUSES } }),
    ]);

    return ok({
      items,
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
      openCount,
      statusCounts: Object.fromEntries(grouped.map((s) => [s._id, s.n])),
      categories: [...COMPLAINT_CATEGORIES],
    });
  });
}

/**
 * Raise a dispute. Either party of a booking may do this, with optional
 * evidence uploaded inline as multipart/form-data.
 */
export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["customer", "worker"]);
    const isMultipart = (req.headers.get("content-type") || "").includes("multipart/form-data");

    let bookingId = "";
    let category = "";
    let subject = "";
    let description = "";
    let evidenceFileIds: string[] = [];
    const uploaded: File[] = [];

    if (isMultipart) {
      const form = await req.formData();
      bookingId = String(form.get("bookingId") || "");
      category = String(form.get("category") || "");
      subject = String(form.get("subject") || "").trim();
      description = String(form.get("description") || "").trim();
      for (const entry of form.getAll("evidence")) {
        if (entry instanceof File && entry.size > 0) uploaded.push(entry);
      }
    } else {
      const body = await readJson<{
        bookingId?: string;
        category?: string;
        subject?: string;
        description?: string;
        evidenceFileIds?: string[];
      }>(req);
      bookingId = String(body.bookingId || "");
      category = String(body.category || "");
      subject = String(body.subject || "").trim();
      description = String(body.description || "").trim();
      evidenceFileIds = Array.isArray(body.evidenceFileIds) ? body.evidenceFileIds.map(String) : [];
    }

    requireValidId(bookingId);
    if (!COMPLAINT_CATEGORIES.includes(category as never)) {
      throw new ApiError("Please choose a valid issue category", 400);
    }
    if (subject.length < 5) throw new ApiError("Please give the case a short subject (min 5 characters)", 400);
    if (description.length < 20) {
      throw new ApiError("Please describe the issue in at least 20 characters", 400);
    }

    await connectDB();

    const booking = await Booking.findById(bookingId);
    if (!booking) throw new ApiError("Booking not found", 404);

    const isCustomer = booking.customerId.toString() === session.sub;
    const isWorker = booking.workerId.toString() === session.sub;
    if (!isCustomer && !isWorker) throw new ApiError("Not authorized", 403);

    if (!DISPUTABLE_BOOKING_STATUSES.includes(booking.status as never)) {
      throw new ApiError("A dispute cannot be raised for a booking in this state", 409);
    }

    const existingOpen = await Dispute.findOne({
      bookingId: booking._id,
      status: { $in: OPEN_DISPUTE_STATUSES },
      $or: [{ raisedBy: session.sub }, { againstUserId: session.sub }],
    });
    if (existingOpen) {
      throw new ApiError("You already have an open case for this booking", 409);
    }

    // Evidence is stored against the dispute, so the dispute id has to exist
    // first: create the case, then attach uploads to it.
    const dispute = await Dispute.create({
      code: newCode(),
      bookingId: booking._id,
      raisedBy: session.sub,
      againstUserId: isCustomer ? booking.workerId : booking.customerId,
      category: category as never,
      subject,
      description,
      status: "open",
      priority: booking.urgency === "emergency" ? "urgent" : "normal",
      evidenceFileIds: [],
      timeline: [
        buildDisputeTimelineEntry("dispute_raised", {
          actorId: new mongoose.Types.ObjectId(session.sub),
          actorRole: session.role,
          note: `Case opened on booking ${booking.code}`,
        }),
      ],
    });

    for (const file of uploaded) {
      const asset = await saveUpload(file, session.sub, "dispute_evidence");
      asset.entityId = dispute._id;
      await asset.save();
      evidenceFileIds.push(asset._id.toString());
    }

    if (evidenceFileIds.length) {
      dispute.evidenceFileIds = evidenceFileIds as never;
      dispute.timeline.push(
        buildDisputeTimelineEntry("evidence_attached", {
          actorId: new mongoose.Types.ObjectId(session.sub),
          actorRole: session.role,
          note: `${evidenceFileIds.length} file(s) attached`,
        }) as never
      );
      await dispute.save();
    }

    booking.disputeOpen = true;
    booking.timeline.push(
      buildDisputeTimelineEntry("dispute_opened", {
        actorId: new mongoose.Types.ObjectId(session.sub),
        actorRole: session.role,
        note: `Dispute ${dispute.code} opened: ${subject}`,
      }) as never
    );
    await booking.save();

    const counterpart = isCustomer ? booking.workerId : booking.customerId;

    await notify(counterpart, {
      type: "dispute_raised",
      title: "A case was opened against your booking",
      body: `${dispute.code}: ${subject}`,
      link: await disputeInboxLink(counterpart, dispute._id),
      category: "booking",
    });
    const admins = await User.find({ role: "admin", status: "active" }).select("_id").lean();
    await notifyMany(
      admins.map((a) => a._id),
      {
        type: "dispute_raised",
        title: `New dispute ${dispute.code}`,
        body: `${category} — booking ${booking.code}`,
        link: `/dashboard/admin/disputes/${dispute._id}`,
        category: "system",
      }
    );

    await logAudit(session, "dispute_created", `Dispute ${dispute.code} raised on booking ${booking.code}`, {
      entity: "Dispute",
      entityId: dispute._id.toString(),
      meta: { category, priority: dispute.priority },
    });

    return ok({ dispute });
  });
}
