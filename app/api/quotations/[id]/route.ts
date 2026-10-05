import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Quotation } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { createBookingFromQuotation } from "@/lib/services/booking";
import { notify } from "@/lib/services/notify";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["customer"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJson<{ action?: "accept" | "reject" | "request_changes"; note?: string }>(req);

    await connectDB();
    const quotation = await Quotation.findById(id);
    if (!quotation) return fail("Quotation not found", 404);
    if (quotation.customerId.toString() !== session.sub) return fail("Not your quotation", 403);
    if (quotation.status !== "pending") throw new ApiError("Quotation is no longer pending", 409);

    if (body.action === "accept") {
      const booking = await createBookingFromQuotation(id, session);
      return ok({ booking, quotation: { ...quotation.toObject(), status: "accepted" } });
    }

    if (body.action === "reject" || body.action === "request_changes") {
      quotation.status = body.action === "reject" ? "rejected" : "changes_requested";
      quotation.customerNote = body.note || "";
      quotation.respondedAt = new Date();
      await quotation.save();
      await notify(quotation.workerId, {
        type: body.action === "reject" ? "quotation_rejected" : "quotation_changes",
        title: body.action === "reject" ? "Quotation declined" : "Customer requested changes",
        body: body.note || "",
        link: `/dashboard/worker/requests/${quotation.requestId}`,
        category: "booking",
      });
      return ok({ quotation });
    }

    throw new ApiError("Unknown action", 400);
  });
}
