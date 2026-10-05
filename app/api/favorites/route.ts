import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { Favorite, WorkerProfile } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const session = await requireAuth(["customer"]);
    await connectDB();
    const favs = await Favorite.find({ customerId: session.sub }).lean();
    const profiles = await WorkerProfile.find({ userId: { $in: favs.map((f) => f.workerId) } })
      .populate("userId", "name avatarFileId")
      .lean();
    return ok({ workers: profiles });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["customer"]);
    const { workerId, remove } = await readJson<{ workerId?: string; remove?: boolean }>(req);
    if (!workerId) throw new ApiError("workerId is required", 400);
    await connectDB();
    if (remove) {
      await Favorite.deleteOne({ customerId: session.sub, workerId });
      return ok({ favorite: false });
    }
    await Favorite.updateOne(
      { customerId: session.sub, workerId },
      { $setOnInsert: { customerId: session.sub, workerId } },
      { upsert: true }
    );
    return ok({ favorite: true });
  });
}
