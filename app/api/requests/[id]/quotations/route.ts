import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ServiceRequest, Quotation, WorkerProfile } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { notify } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{
      laborCost?: number;
      materialsCost?: number;
      transportCost?: number;
      otherCost?: number;
      estimatedDuration?: string;
      proposedStartDate?: string;
      proposedEndDate?: string;
      warrantyDays?: number;
      notes?: string;
      paymentPlan?: { label: string; percent: number }[];
    }>(req);

    await connectDB();
    const request = await ServiceRequest.findById(id);
    if (!request) return fail("Request not found", 404);
    // BR-04: offers are possible while the request is open or already receiving quotes
    if (!["open", "quoted"].includes(request.status)) {
      throw new ApiError("This request is no longer open for quotations", 409);
    }
    if (request.customerId.toString() === session.sub) throw new ApiError("You cannot quote your own request", 400);

    const existing = await Quotation.findOne({ requestId: id, workerId: session.sub });
    if (existing && existing.status !== "withdrawn") throw new ApiError("You already submitted a quotation", 409);

    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);
    if (profile.status !== "approved") throw new ApiError("Your profile must be verified before quoting", 403);
    if (profile.availability === "offline") throw new ApiError("You are offline. Update availability first.", 409);

    const laborCost = Number(body.laborCost || 0);
    if (laborCost <= 0) throw new ApiError("Labor cost must be greater than 0", 400);
    const materialsCost = Number(body.materialsCost || 0);
    const transportCost = Number(body.transportCost || 0);
    const otherCost = Number(body.otherCost || 0);
    const total = laborCost + materialsCost + transportCost + otherCost;

    let plan = body.paymentPlan?.filter((p) => p.label && p.percent > 0) || [];
    if (plan.length) {
      const sum = plan.reduce((s, p) => s + p.percent, 0);
      if (sum !== 100) throw new ApiError(`Payment plan percentages must total 100% (currently ${sum}%)`, 400);
    } else {
      plan = [
        { label: "Advance payment", percent: 30 },
        { label: "Work progress", percent: 40 },
        { label: "Final payment", percent: 30 },
      ];
    }

    const responseMinutes = Math.round((Date.now() - new Date(request.createdAt).getTime()) / 60000);

    const quotation = await Quotation.create({
      requestId: request._id,
      workerId: session.sub,
      customerId: request.customerId,
      laborCost,
      materialsCost,
      transportCost,
      otherCost,
      total,
      estimatedDuration: body.estimatedDuration || "",
      proposedStartDate: body.proposedStartDate ? new Date(body.proposedStartDate) : null,
      proposedEndDate: body.proposedEndDate ? new Date(body.proposedEndDate) : null,
      warrantyDays: Number(body.warrantyDays || 0),
      paymentPlan: plan,
      notes: body.notes || "",
      status: "pending",
      responseMinutes,
    });

    if (request.status === "open") {
      request.status = "quoted";
      await request.save();
    }

    profile.responseTimeMinutes = Math.round(
      (profile.responseTimeMinutes * 0.7) + (Math.min(responseMinutes, 480) * 0.3)
    );
    await profile.save();

    await notify(request.customerId, {
      type: "quotation_received",
      title: "New quotation received",
      body: `A worker quoted ${total} ETB for "${request.title}".`,
      link: `/dashboard/customer/requests/${request._id}`,
      category: "booking",
    });
    await logAudit(session, "quotation_submitted", `Quotation of ${total} ETB for ${request.reference}`, {
      entity: "Quotation",
      entityId: quotation._id.toString(),
      meta: { total },
    });

    return ok({ quotation });
  });
}
