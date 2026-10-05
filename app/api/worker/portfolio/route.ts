import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WorkerProfile } from "@/lib/models";
import { handle, ok, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { saveUpload, deleteUpload } from "@/lib/services/files";

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const category = String(form.get("category") || "");
    const description = String(form.get("description") || "");
    const area = String(form.get("area") || "");
    const completedAt = form.get("completedAt") ? new Date(String(form.get("completedAt"))) : null;
    if (!title) throw new ApiError("Portfolio title is required", 400);

    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);
    if ((profile.portfolio?.length || 0) >= 20) throw new ApiError("Portfolio limit reached (20)", 409);

    let beforeFileId = null,
      duringFileId = null,
      afterFileId = null;
    for (const key of ["before", "during", "after"] as const) {
      const file = form.get(key);
      if (file && typeof file !== "string" && file.size > 0) {
        const asset = await saveUpload(file, session.sub, "portfolio");
        if (key === "before") beforeFileId = asset._id;
        if (key === "during") duringFileId = asset._id;
        if (key === "after") afterFileId = asset._id;
      }
    }

    profile.portfolio = profile.portfolio || [];
    profile.portfolio.push({
      title,
      category,
      description,
      area,
      completedAt,
      beforeFileId,
      duringFileId,
      afterFileId,
      status: "published",
    } as never);
    await profile.save();
    return ok({ portfolio: profile.portfolio });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) throw new ApiError("Portfolio id is required", 400);
    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);
    const item = (profile.portfolio || []).find((p) => p._id.toString() === id);
    if (!item) throw new ApiError("Portfolio item not found", 404);
    for (const key of ["beforeFileId", "duringFileId", "afterFileId"] as const) {
      if (item[key]) await deleteUpload(String(item[key]));
    }
    profile.portfolio = (profile.portfolio || []).filter((p) => p._id.toString() !== id) as never;
    await profile.save();
    return ok({ portfolio: profile.portfolio });
  });
}
