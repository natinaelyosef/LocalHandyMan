import { NextRequest } from "next/server";
import type { PipelineStage } from "mongoose";
import { connectDB } from "@/lib/db";
import { WorkerProfile, Favorite } from "@/lib/models";
import { handle, ok, getSession } from "@/lib/http";

export const dynamic = "force-dynamic";

function esc(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const p = req.nextUrl.searchParams;
    const q = p.get("q")?.trim() || "";
    const category = p.get("category") || "";
    const city = p.get("city")?.trim() || "";
    const region = p.get("region")?.trim() || "";
    const availability = p.get("availability") || "";
    const emergency = p.get("emergency") === "1";
    const minPrice = Number(p.get("minPrice") || 0);
    const maxPrice = Number(p.get("maxPrice") || 0);
    const minExperience = Number(p.get("experience") || 0);
    const minRating = Number(p.get("rating") || 0);
    const includeUnverified = p.get("verified") === "0";
    const sort = p.get("sort") || "relevance";
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Math.max(1, Number(p.get("limit") || 12)));

    await connectDB();

    const match: Record<string, unknown> = {};
    match.status = includeUnverified ? { $in: ["approved", "pending"] } : "approved";
    if (category) match.categoryIds = { $in: [category] };
    if (availability) match.availability = availability;
    if (emergency) match.emergencyAvailable = true;
    if (minExperience > 0) match.yearsOfExperience = { $gte: minExperience };
    const price: Record<string, number> = {};
    if (minPrice > 0) price.$gte = minPrice;
    if (maxPrice > 0) price.$lte = maxPrice;
    if (Object.keys(price).length) match.startingPrice = price;
    if (city) match["serviceArea.city"] = new RegExp(`^${esc(city)}$`, "i");
    if (region) match["serviceArea.region"] = new RegExp(`^${esc(region)}$`, "i");

    const pipeline: PipelineStage[] = [
      { $match: match },
      {
        $lookup: {
          from: "users",
          localField: "userId",
          foreignField: "_id",
          as: "user",
          pipeline: [{ $project: { name: 1, avatarFileId: 1, createdAt: 1 } }],
        },
      },
      { $unwind: "$user" },
    ];

    if (q) {
      const rx = new RegExp(esc(q), "i");
      pipeline.push({
        $match: {
          $or: [{ headline: rx }, { profession: rx }, { skills: rx }, { bio: rx }, { "user.name": rx }],
        },
      });
    }

    if (minRating > 0) {
      pipeline.push({
        $match: {
          "stats.ratingCount": { $gte: 1 },
          $expr: { $gte: [{ $divide: ["$stats.ratingSum", "$stats.ratingCount"] }, minRating] },
        },
      });
    }

    pipeline.push({
      $addFields: {
        rating: {
          $cond: [
            { $gt: ["$stats.ratingCount", 0] },
            { $round: [{ $divide: ["$stats.ratingSum", "$stats.ratingCount"] }, 1] },
            0,
          ],
        },
      },
    });

    const sortStage: Record<string, 1 | -1> =
      sort === "price_asc"
        ? { startingPrice: 1 }
        : sort === "price_desc"
          ? { startingPrice: -1 }
          : sort === "rating"
            ? { rating: -1, "stats.ratingCount": -1 }
            : sort === "experience"
              ? { yearsOfExperience: -1 }
              : sort === "recent"
                ? { createdAt: -1 }
                : { featured: -1, rating: -1, "stats.jobsCompleted": -1 };

    pipeline.push({ $sort: sortStage });
    pipeline.push({
      $facet: {
        items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
        total: [{ $count: "n" }],
      },
    });

    const agg = await WorkerProfile.aggregate(pipeline);
    const items = (agg[0]?.items || []) as Array<Record<string, unknown>>;
    const total = (agg[0]?.total?.[0]?.n as number) || 0;

    let favorites: string[] = [];
    const session = await getSession();
    if (session?.role === "customer") {
      const favs = await Favorite.find({ customerId: session.sub }).lean();
      favorites = favs.map((f) => f.workerId.toString());
    }

    const safeItems = items.map((w) => ({
      _id: w._id,
      userId: String(w.userId),
      name: (w.user as { name: string }).name,
      avatarFileId: (w.user as { avatarFileId: unknown }).avatarFileId,
      profession: w.profession,
      headline: w.headline,
      bio: w.bio,
      skills: w.skills,
      yearsOfExperience: w.yearsOfExperience,
      startingPrice: w.startingPrice,
      availability: w.availability,
      emergencyAvailable: w.emergencyAvailable,
      serviceArea: w.serviceArea,
      rating: w.rating,
      stats: w.stats,
      responseTimeMinutes: w.responseTimeMinutes,
      featured: w.featured,
      verified: w.status === "approved",
      favorite: favorites.includes(String(w.userId)),
    }));

    return ok({ items: safeItems, total, page, limit, pages: Math.ceil(total / limit) });
  });
}
