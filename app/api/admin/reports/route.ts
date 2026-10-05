import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import {
  Booking,
  Dispute,
  PaymentProof,
  Quotation,
  ServiceRequest,
  User,
  WorkerProfile,
} from "@/lib/models";
import { handle, ok, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { csvResponse, dateRange, isoDay, toCsv } from "@/lib/services/csv";
import { OPEN_DISPUTE_STATUSES } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Report = "bookings" | "verification" | "proofs";

function isReport(v: string | null): v is Report {
  return v === "bookings" || v === "verification" || v === "proofs";
}

/** GET with `?format=summary` (default) returns bottleneck metrics for the UI. */
export async function GET(req: NextRequest) {
  return handle(async () => {
    await requireAuth(["admin"]);
    const p = req.nextUrl.searchParams;
    const { from, to } = dateRange(p.get("from"), p.get("to"));
    await connectDB();

    const createdInRange = { $gte: from, $lte: to };

    const [
      bookingTotal,
      bookingByStatus,
      bookingByCategory,
      bookingByUrgency,
      bookingDaily,
      proofTotal,
      proofByStatus,
      proofPendingAges,
      workerTotal,
      workerByStatus,
      workerDocPending,
      workerDocAges,
      quotationByStatus,
      requestByStatus,
      disputeByStatus,
      disputeOpen,
      topWorkers,
      proofReviewLag,
    ] = await Promise.all([
      Booking.countDocuments({ createdAt: createdInRange }),
      Booking.aggregate([
        { $match: { createdAt: createdInRange } },
        { $group: { _id: "$status", n: { $sum: 1 }, value: { $sum: "$agreedTotal" } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: createdInRange } },
        {
          $lookup: {
            from: "servicecategories",
            localField: "categoryId",
            foreignField: "_id",
            as: "cat",
          },
        },
        { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
        { $group: { _id: { $ifNull: ["$cat.name", "Uncategorised"] }, n: { $sum: 1 }, value: { $sum: "$agreedTotal" } } },
        { $sort: { n: -1 } },
        { $limit: 12 },
      ]),
      Booking.aggregate([
        { $match: { createdAt: createdInRange } },
        { $group: { _id: "$urgency", n: { $sum: 1 } } },
      ]),
      Booking.aggregate([
        { $match: { createdAt: createdInRange } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            n: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $in: ["$status", ["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"]] }, 1, 0] },
            },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      PaymentProof.countDocuments({ createdAt: createdInRange }),
      PaymentProof.aggregate([
        { $match: { createdAt: createdInRange } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      // How long pending proofs have been waiting — the proof-review bottleneck.
      PaymentProof.aggregate([
        { $match: { status: "pending" } },
        {
          $project: {
            ageHours: { $divide: [{ $subtract: [new Date(), "$createdAt"] }, 3600000] },
          },
        },
        {
          $group: {
            _id: null,
            n: { $sum: 1 },
            avgAgeHours: { $avg: "$ageHours" },
            oldestAgeHours: { $max: "$ageHours" },
            over24h: { $sum: { $cond: [{ $gt: ["$ageHours", 24] }, 1, 0] } },
            over72h: { $sum: { $cond: [{ $gt: ["$ageHours", 72] }, 1, 0] } },
          },
        },
      ]),
      WorkerProfile.countDocuments({}),
      WorkerProfile.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }]),
      WorkerProfile.aggregate([
        { $unwind: "$documents" },
        { $match: { "documents.status": "pending" } },
        { $count: "n" },
      ]),
      // Age of documents still pending — the verification bottleneck.
      WorkerProfile.aggregate([
        { $unwind: "$documents" },
        { $match: { "documents.status": "pending" } },
        { $project: { ageHours: { $divide: [{ $subtract: [new Date(), "$documents.createdAt"] }, 3600000] } } },
        {
          $group: {
            _id: null,
            n: { $sum: 1 },
            avgAgeHours: { $avg: "$ageHours" },
            oldestAgeHours: { $max: "$ageHours" },
          },
        },
      ]),
      Quotation.aggregate([
        { $match: { createdAt: createdInRange } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      ServiceRequest.aggregate([
        { $match: { createdAt: createdInRange } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      Dispute.aggregate([
        { $match: { createdAt: createdInRange } },
        { $group: { _id: "$status", n: { $sum: 1 } } },
      ]),
      Dispute.countDocuments({ status: { $in: OPEN_DISPUTE_STATUSES } }),
      Booking.aggregate([
        { $match: { createdAt: createdInRange, status: "COMPLETED" } },
        {
          $group: {
            _id: "$workerId",
            jobs: { $sum: 1 },
            value: { $sum: "$agreedTotal" },
          },
        },
        { $sort: { jobs: -1 } },
        { $limit: 10 },
      ]),
      // Average turnaround from submission to review — the proof-review bottleneck.
      PaymentProof.aggregate([
        { $match: { createdAt: createdInRange, reviewedAt: { $ne: null } } },
        {
          $project: {
            lagHours: { $divide: [{ $subtract: ["$reviewedAt", "$createdAt"] }, 3600000] },
          },
        },
        { $group: { _id: null, avgLagHours: { $avg: "$lagHours" }, n: { $sum: 1 } } },
      ]),
    ]);

    const workerIds = topWorkers.map((w) => w._id);
    const workerNames = workerIds.length
      ? await User.find({ _id: { $in: workerIds } }).select("name").lean()
      : [];
    const nameById = new Map(workerNames.map((w) => [String(w._id), w.name]));

    const map = (rows: { _id: unknown; n: number }[]) =>
      Object.fromEntries(rows.map((r) => [String(r._id), r.n]));

    return ok({
      range: { from: isoDay(from), to: isoDay(to) },
      bookings: {
        total: bookingTotal,
        byStatus: bookingByStatus.map((r) => ({ status: r._id, n: r.n, value: r.value || 0 })),
        byCategory: bookingByCategory.map((r) => ({ name: r._id, n: r.n, value: r.value || 0 })),
        byUrgency: map(bookingByUrgency),
        daily: bookingDaily,
        totalValue: bookingByStatus.reduce((s, r) => s + (r.value || 0), 0),
      },
      verification: {
        totalWorkers: workerTotal,
        byStatus: map(workerByStatus),
        pendingDocuments: workerDocPending[0]?.n || 0,
        pendingDocAge: workerDocAges[0]
          ? {
              avgAgeHours: Math.round(workerDocAges[0].avgAgeHours || 0),
              oldestAgeHours: Math.round(workerDocAges[0].oldestAgeHours || 0),
            }
          : null,
      },
      proofs: {
        total: proofTotal,
        byStatus: map(proofByStatus),
        pending: proofPendingAges[0]
          ? {
              n: proofPendingAges[0].n,
              avgAgeHours: Math.round(proofPendingAges[0].avgAgeHours || 0),
              oldestAgeHours: Math.round(proofPendingAges[0].oldestAgeHours || 0),
              over24h: proofPendingAges[0].over24h || 0,
              over72h: proofPendingAges[0].over72h || 0,
            }
          : null,
        reviewLagHours: proofReviewLag[0]
          ? Math.round(proofReviewLag[0].avgLagHours || 0)
          : null,
        reviewed: proofReviewLag[0]?.n || 0,
      },
      pipeline: {
        quotations: map(quotationByStatus),
        requests: map(requestByStatus),
        disputes: map(disputeByStatus),
        openDisputes: disputeOpen,
      },
      topWorkers: topWorkers.map((w) => ({
        workerId: String(w._id),
        name: nameById.get(String(w._id)) || "—",
        jobs: w.jobs,
        value: w.value || 0,
      })),
    });
  });
}

/** GET with `?format=csv&report=<report>` streams a CSV export. */
export async function POST(req: NextRequest) {
  return handle(async () => {
    await requireAuth(["admin"]);
    const p = req.nextUrl.searchParams;
    const report = p.get("report");
    if (!isReport(report)) {
      throw new ApiError("report must be one of: bookings, verification, proofs", 400);
    }
    const { from, to } = dateRange(p.get("from"), p.get("to"));
    const createdInRange = { $gte: from, $lte: to };
    await connectDB();

    if (report === "bookings") {
      const rows = await Booking.find({ createdAt: createdInRange })
        .sort({ createdAt: -1 })
        .limit(5000)
        .populate("customerId", "name email phone")
        .populate("workerId", "name email phone")
        .populate("categoryId", "name")
        .lean();
      const csv = toCsv(
        [
          "code",
          "title",
          "status",
          "urgency",
          "category",
          "customer",
          "customer_email",
          "worker",
          "worker_email",
          "agreed_total_etb",
          "verified_paid_etb",
          "start_date",
          "expected_completion",
          "completed_at",
          "cancelled_at",
          "dispute_open",
          "created_at",
        ],
        rows.map((b) => {
          const customer = b.customerId as unknown as { name?: string; email?: string };
          const worker = b.workerId as unknown as { name?: string; email?: string };
          const category = b.categoryId as unknown as { name?: string } | null;
          return [
            b.code,
            b.title,
            b.status,
            b.urgency,
            category?.name || "",
            customer?.name || "",
            customer?.email || "",
            worker?.name || "",
            worker?.email || "",
            b.agreedTotal,
            b.paymentSummary?.verified ?? 0,
            isoDay(b.startDate),
            isoDay(b.expectedCompletion),
            isoDay(b.completedAt),
            isoDay(b.cancelledAt),
            b.disputeOpen ? "yes" : "no",
            isoDay(b.createdAt),
          ];
        })
      );
      return csvResponse("bookings", csv);
    }

    if (report === "verification") {
      const rows = await WorkerProfile.find({})
        .sort({ createdAt: -1 })
        .limit(5000)
        .populate("userId", "name email phone")
        .lean();
      const csv = toCsv(
        [
          "name",
          "email",
          "phone",
          "profession",
          "status",
          "verified_at",
          "years_experience",
          "starting_price_etb",
          "region",
          "city",
          "pending_documents",
          "approved_documents",
          "rejected_documents",
          "average_doc_age_hours",
          "jobs_completed",
          "rating_count",
          "created_at",
        ],
        rows.map((w) => {
          const user = w.userId as unknown as { name?: string; email?: string; phone?: string };
          const docs = w.documents || [];
          const pending = docs.filter((d) => d.status === "pending");
          const ages = pending
            .map((d) => (new Date().getTime() - new Date(d.createdAt).getTime()) / 3600000)
            .filter((n) => !isNaN(n));
          return [
            user?.name || "",
            user?.email || "",
            user?.phone || "",
            w.profession,
            w.status,
            isoDay(w.verifiedAt),
            w.yearsOfExperience,
            w.startingPrice,
            w.serviceArea?.region || "",
            w.serviceArea?.city || "",
            pending.length,
            docs.filter((d) => d.status === "approved").length,
            docs.filter((d) => d.status === "rejected").length,
            ages.length ? Math.round(ages.reduce((s, n) => s + n, 0) / ages.length) : "",
            w.stats?.jobsCompleted ?? 0,
            w.stats?.ratingCount ?? 0,
            isoDay(w.createdAt),
          ];
        })
      );
      return csvResponse("worker-verification", csv);
    }

    const rows = await PaymentProof.find({ createdAt: createdInRange })
      .sort({ createdAt: -1 })
      .limit(5000)
      .populate("customerId", "name email")
      .populate("bookingId", "code title")
      .lean();
    const csv = toCsv(
      [
        "reference",
        "status",
        "booking_code",
        "booking_title",
        "customer",
        "customer_email",
        "amount_paid_etb",
        "required_amount_etb",
        "difference_etb",
        "bank",
        "sender_name",
        "sender_account",
        "receiver_account",
        "paid_at",
        "submitted_at",
        "reviewed_at",
        "turnaround_hours",
        "duplicate_flag",
        "underpaid_by",
        "rejection_reason",
      ],
      rows.map((pr) => {
        const customer = pr.customerId as unknown as { name?: string; email?: string };
        const booking = pr.bookingId as unknown as { code?: string; title?: string };
        const turnaround =
          pr.reviewedAt && pr.createdAt
            ? Math.round(
                (new Date(pr.reviewedAt).getTime() - new Date(pr.createdAt).getTime()) / 3600000
              )
            : "";
        return [
          pr.reference,
          pr.status,
          booking?.code || "",
          booking?.title || "",
          customer?.name || "",
          customer?.email || "",
          pr.amountPaid,
          pr.requiredAmount,
          pr.amountPaid - pr.requiredAmount,
          pr.bank,
          pr.senderName,
          pr.senderAccount || "",
          pr.receiverAccount || "",
          isoDay(pr.paidAt),
          isoDay(pr.createdAt),
          isoDay(pr.reviewedAt),
          turnaround,
          pr.duplicateFlag ? "yes" : "no",
          pr.underpaidBy || 0,
          pr.rejectionReason || "",
        ];
      })
    );
    return csvResponse("payment-proof-review", csv);
  });
}
