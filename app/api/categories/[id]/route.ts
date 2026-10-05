import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ServiceCategory, ServiceRequest } from "@/lib/models";
import { handle, ok, fail, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    requireValidId(id);
    await connectDB();
    const cat = await ServiceCategory.findById(id).lean();
    if (!cat) return fail("Category not found", 404);
    return ok(cat);
  });
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    const body = await readJsonBody(req);
    await connectDB();
    const cat = await ServiceCategory.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!cat) return fail("Category not found", 404);
    await logAudit(session, "category_updated", `Category "${cat.name}" updated`, { entity: "ServiceCategory", entityId: id });
    return ok(cat);
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const { id } = await ctx.params;
    requireValidId(id);
    await connectDB();
    const usage = await ServiceRequest.countDocuments({ categoryId: id, status: { $ne: "cancelled" } });
    if (usage > 0) throw new ApiError("Category is in use and cannot be deleted. Deactivate it instead.", 409);
    const cat = await ServiceCategory.findByIdAndDelete(id);
    if (!cat) return fail("Category not found", 404);
    await ServiceCategory.updateMany({ parent: id }, { parent: null });
    await logAudit(session, "category_deleted", `Category "${cat.name}" deleted`, { entity: "ServiceCategory", entityId: id });
    return ok({ deleted: true });
  });
}

async function readJsonBody(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
}
