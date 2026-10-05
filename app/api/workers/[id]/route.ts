import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WorkerProfile, User, Review, Favorite } from "@/lib/models";
import { handle, ok, fail, requireValidId, getSession } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    requireValidId(id);
    await connectDB();

    const profile = await WorkerProfile.findOne({ userId: id }).lean();
    if (!profile) return fail("Worker not found", 404);
    const user = await User.findById(id)
      .select("name avatarFileId createdAt phone email")
      .lean();
    if (!user) return fail("Worker not found", 404);

    const reviews = await Review.find({ workerId: id, status: "visible" })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate("customerId", "name avatarFileId")
      .lean();

    const stats = profile.stats || { jobsCompleted: 0, jobsCancelled: 0, ratingSum: 0, ratingCount: 0 };
    const rating = stats.ratingCount > 0
      ? Math.round((stats.ratingSum / stats.ratingCount) * 10) / 10
      : 0;

    let favorite = false;
    const session = await getSession();
    if (session?.role === "customer") {
      favorite = !!(await Favorite.exists({ customerId: session.sub, workerId: id }));
    }

    return ok({
      worker: {
        _id: profile._id,
        userId: id,
        name: user.name,
        avatarFileId: user.avatarFileId,
        email: user.email,
        phone: user.phone,
        createdAt: user.createdAt,
        profession: profile.profession,
        headline: profile.headline,
        bio: profile.bio,
        skills: profile.skills,
        yearsOfExperience: profile.yearsOfExperience,
        languages: profile.languages,
        startingPrice: profile.startingPrice,
        priceNote: profile.priceNote,
        serviceArea: profile.serviceArea,
        availability: profile.availability,
        emergencyAvailable: profile.emergencyAvailable,
        schedule: profile.schedule,
        status: profile.status,
        verified: profile.status === "approved",
        verifiedAt: profile.verifiedAt,
        responseTimeMinutes: profile.responseTimeMinutes,
        stats: profile.stats,
        rating,
        portfolio: (profile.portfolio || []).filter((p) => p.status === "published"),
        featured: profile.featured,
        favorite,
      },
      reviews,
    });
  });
}
