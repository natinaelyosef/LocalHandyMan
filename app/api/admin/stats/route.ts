import { connectDB } from "@/lib/db";
import { User, WorkerProfile, Booking, ServiceRequest, PaymentProof, Review, AuditLog, Quotation, Conversation } from "@/lib/models";
import { handle, ok } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    await requireAuth(["admin"]);
    await connectDB();

    const [
      totalCustomers,
      totalWorkers,
      pendingWorkers,
      verifiedWorkers,
      suspendedWorkers,
      activeBookings,
      completedBookings,
      cancelledBookings,
      disputedBookings,
      openRequests,
      pendingProofs,
      verifiedProofs,
      rejectedProofs,
      totalReviews,
      openConversations,
      last30Users,
    ] = await Promise.all([
      User.countDocuments({ role: "customer" }),
      User.countDocuments({ role: "worker" }),
      WorkerProfile.countDocuments({ status: "pending" }),
      WorkerProfile.countDocuments({ status: "approved" }),
      WorkerProfile.countDocuments({ status: { $in: ["suspended", "rejected"] } }),
      Booking.countDocuments({ status: { $nin: ["CLOSED", "CANCELLED", "REJECTED", "EXPIRED"] } }),
      Booking.countDocuments({ status: { $in: ["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"] } }),
      Booking.countDocuments({ status: "CANCELLED" }),
      Booking.countDocuments({ status: "DISPUTED" }),
      ServiceRequest.countDocuments({ status: { $in: ["open", "quoted"] } }),
      PaymentProof.countDocuments({ status: "pending" }),
      PaymentProof.countDocuments({ status: "verified" }),
      PaymentProof.countDocuments({ status: "rejected" }),
      Review.countDocuments({ status: "visible" }),
      Conversation.countDocuments(),
      User.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 86400000) } }),
    ]);

    const verifiedAmount = await PaymentProof.aggregate([
      { $match: { status: "verified" } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);
    const pendingAmount = await PaymentProof.aggregate([
      { $match: { status: "pending" } },
      { $group: { _id: null, total: { $sum: "$amountPaid" } } },
    ]);

    const byCategory = await Booking.aggregate([
      { $lookup: { from: "servicecategories", localField: "categoryId", foreignField: "_id", as: "cat" } },
      { $unwind: { path: "$cat", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$cat.name", n: { $sum: 1 } } },
      { $sort: { n: -1 } },
      { $limit: 8 },
    ]);

    const byStatus = await Booking.aggregate([{ $group: { _id: "$status", n: { $sum: 1 } } }, { $sort: { n: -1 } }]);

    const monthly = await Booking.aggregate([
      {
        $group: {
          _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" } },
          n: { $sum: 1 },
          completed: { $sum: { $cond: [{ $in: ["$status", ["CLOSED", "COMPLETED", "CUSTOMER_CONFIRMED"]] }, 1, 0] } },
        },
      },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
      { $limit: 12 },
    ]);

    const registrations = await User.aggregate([
      { $group: { _id: { y: { $year: "$createdAt" }, m: { $month: "$createdAt" }, role: "$role" }, n: { $sum: 1 } } },
      { $sort: { "_id.y": 1, "_id.m": 1 } },
      { $limit: 24 },
    ]);

    const urgency = await ServiceRequest.aggregate([{ $group: { _id: "$urgency", n: { $sum: 1 } } }]);
    const recentAudit = await AuditLog.find().sort({ createdAt: -1 }).limit(8).lean();
    const quotationsTotal = await Quotation.countDocuments();

    return ok({
      totals: {
        totalCustomers,
        totalWorkers,
        pendingWorkers,
        verifiedWorkers,
        suspendedWorkers,
        activeBookings,
        completedBookings,
        cancelledBookings,
        disputedBookings,
        openRequests,
        pendingProofs,
        verifiedProofs,
        rejectedProofs,
        totalReviews,
        openConversations,
        last30Users,
        quotationsTotal,
        verifiedAmount: verifiedAmount[0]?.total || 0,
        pendingAmount: pendingAmount[0]?.total || 0,
        cancellationRate:
          completedBookings + cancelledBookings > 0
            ? Math.round((cancelledBookings / (completedBookings + cancelledBookings)) * 100)
            : 0,
      },
      charts: { byCategory, byStatus, monthly, registrations, urgency },
      recentAudit,
    });
  });
}
