import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Address } from "@/lib/models";
import { handle, ok, fail, readJson, requireValidId, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const session = await requireAuth();
    await connectDB();
    const addresses = await Address.find({ userId: session.sub }).sort({ isDefault: -1, createdAt: 1 }).lean();
    return ok({ addresses });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const body = await readJson<Record<string, unknown>>(req);
    if (!body.label || !body.region || !body.city) throw new ApiError("Label, region and city are required", 400);
    await connectDB();
    const count = await Address.countDocuments({ userId: session.sub });
    if (count >= 15) throw new ApiError("Address limit reached (15)", 409);
    if (body.isDefault || count === 0) await Address.updateMany({ userId: session.sub }, { isDefault: false });
    const address = await Address.create({ ...body, userId: session.sub, isDefault: body.isDefault || count === 0 } as never);
    return ok(address);
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const body = await readJson<{ id?: string } & Record<string, unknown>>(req);
    if (!body.id) throw new ApiError("Address id is required", 400);
    requireValidId(body.id);
    await connectDB();
    const address = await Address.findOne({ _id: body.id, userId: session.sub });
    if (!address) return fail("Address not found", 404);
    if (body.isDefault) await Address.updateMany({ userId: session.sub }, { isDefault: false });
    Object.assign(address, body);
    await address.save();
    return ok(address);
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const { id } = await readJson<{ id?: string }>(req);
    if (!id) throw new ApiError("Address id is required", 400);
    requireValidId(id);
    await connectDB();
    const address = await Address.findOneAndDelete({ _id: id, userId: session.sub });
    if (!address) return fail("Address not found", 404);
    return ok({ deleted: true });
  });
}
