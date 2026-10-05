import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WorkerProfile, User, ServiceCategory } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { PROFESSIONS } from "@/lib/constants";
import { logAudit } from "@/lib/services/audit";

const EDITABLE = [
  "profession",
  "headline",
  "bio",
  "skills",
  "yearsOfExperience",
  "languages",
  "startingPrice",
  "priceNote",
  "categoryIds",
  "serviceArea",
  "emergencyAvailable",
  "schedule",
  "availability",
] as const;

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const body = await readJson<Record<string, unknown>>(req);
    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);

    if (body.profession && !PROFESSIONS.includes(body.profession as never)) {
      throw new ApiError("Invalid profession", 400);
    }
    if (body.categoryIds) {
      const ids = body.categoryIds as string[];
      const valid = await ServiceCategory.countDocuments({ _id: { $in: ids } });
      if (valid !== ids.length) throw new ApiError("Invalid category", 400);
    }

    for (const key of EDITABLE) {
      if (body[key] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (profile as any)[key] = body[key];
      }
    }

    const resubmit = body.resubmit === true;
    if (resubmit && ["rejected", "resubmit_required", "suspended"].includes(profile.status)) {
      profile.status = "pending";
      profile.statusNote = "";
      await logAudit(session, "worker_resubmitted", "Worker resubmitted profile for verification");
    }

    await profile.save();
    return ok({ profile });
  });
}

export async function GET() {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: session.sub }).lean();
    const user = await User.findById(session.sub).select("name email phone avatarFileId status").lean();
    return ok({ profile, user });
  });
}
