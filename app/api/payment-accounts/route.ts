import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { PaymentAccount } from "@/lib/models";
import { handle, ok, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireAuth();
    if (session.role === "admin") {
      await connectDB();
      const accounts = await PaymentAccount.find().sort({ order: 1, createdAt: 1 }).lean();
      return ok({ accounts });
    }
    await connectDB();
    const accounts = await PaymentAccount.find({ active: true }).sort({ order: 1 }).lean();
    return ok({ accounts });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const body = await readJson<{ bank?: string; accountName?: string; accountNumber?: string; branch?: string; instructions?: string; active?: boolean; order?: number }>(req);
    if (!body.accountName || !body.accountNumber) throw new ApiError("Account name and number are required", 400);
    await connectDB();
    if (body.active) await PaymentAccount.updateMany({}, { active: false });
    const account = await PaymentAccount.create({
      bank: body.bank || "Commercial Bank of Ethiopia",
      accountName: body.accountName,
      accountNumber: body.accountNumber,
      branch: body.branch || "",
      instructions: body.instructions || "",
      active: body.active ?? true,
      order: body.order ?? 0,
    });
    await logAudit(session, "payment_account_created", `CBE account ${account.accountNumber} added`);
    return ok(account);
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const body = await readJson<{ id?: string } & Record<string, unknown>>(req);
    if (!body.id) throw new ApiError("Account id is required", 400);
    requireValidId(body.id);
    await connectDB();
    if (body.active === true) await PaymentAccount.updateMany({ _id: { $ne: body.id } }, { active: false });
    const account = await PaymentAccount.findByIdAndUpdate(body.id, body, { new: true });
    if (!account) return ok({ error: "not found" }, { status: 404 });
    await logAudit(session, "payment_account_updated", `CBE account ${account.accountNumber} updated`);
    return ok(account);
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const { id } = await readJson<{ id?: string }>(req);
    if (!id) throw new ApiError("Account id is required", 400);
    requireValidId(id);
    await connectDB();
    await PaymentAccount.findByIdAndDelete(id);
    await logAudit(session, "payment_account_deleted", `CBE account removed`);
    return ok({ deleted: true });
  });
}
