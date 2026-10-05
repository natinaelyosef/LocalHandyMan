import { NextRequest } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { ServiceRequest, Address, ServiceCategory, WorkerProfile, Quotation } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { saveUpload } from "@/lib/services/files";
import { notifyMany } from "@/lib/services/notify";
import { logAudit } from "@/lib/services/audit";
import { URGENCY, type Urgency } from "@/lib/constants";

export const dynamic = "force-dynamic";

function ref() {
  return `SR${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 90 + 10)}`;
}

export async function GET(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const p = req.nextUrl.searchParams;
    const view = p.get("view") || "mine";
    const page = Math.max(1, Number(p.get("page") || 1));
    const limit = Math.min(50, Number(p.get("limit") || 10));
    await connectDB();

    const filter: Record<string, unknown> = {};
    if (view === "available" && session.role === "worker") {
      // FR-REQ-07/08: every provider sees every homeowner's jobs.
      // No implicit category/city restriction — those are optional query filters only.
      filter.status = { $in: ["open", "quoted"] };
      filter.customerId = { $ne: session.sub };
      filter.urgency = p.get("emergency") === "1" ? { $in: ["emergency", "urgent"] } : { $in: URGENCY };
      const catFilter = p.get("category");
      if (catFilter) filter.categoryId = catFilter;
    } else if (session.role === "customer") {
      filter.customerId = session.sub;
      const status = p.get("status");
      if (status) filter.status = status;
      else filter.status = { $ne: "expired" };
    } else if (session.role === "admin") {
      const status = p.get("status");
      if (status) filter.status = status;
    } else {
      throw new ApiError("Not authorized", 403);
    }

    const sort = view === "available"
      ? ({ createdAt: -1 } as Record<string, 1 | -1>)
      : ({ createdAt: -1 } as Record<string, 1 | -1>);

    const [items, total] = await Promise.all([
      ServiceRequest.find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("categoryId", "name slug icon")
        .populate("customerId", "name avatarFileId")
        .lean(),
      ServiceRequest.countDocuments(filter),
    ]);

    const counts = items.length
      ? await Quotation.aggregate<{ _id: mongoose.Types.ObjectId; n: number }>([
          { $match: { requestId: { $in: items.map((i) => i._id) } } },
          { $group: { _id: "$requestId", n: { $sum: 1 } } },
        ])
      : [];
    const countMap = new Map(counts.map((c) => [c._id.toString(), c.n]));

    return ok({
      items: items.map((i) => ({ ...i, quotationCount: countMap.get(String(i._id)) || 0 })),
      total,
      page,
      limit,
      pages: Math.ceil(total / limit),
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["customer"]);
    const contentType = req.headers.get("content-type") || "";
    await connectDB();

    let body: Record<string, unknown>;
    const mediaIds: unknown[] = [];

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      body = Object.fromEntries([...form.entries()].filter(([, v]) => typeof v === "string") as [string, string][]);
      for (const key of ["photo1", "photo2", "photo3"]) {
        const f = form.get(key);
        if (f && typeof f !== "string" && f.size > 0) {
          const asset = await saveUpload(f, session.sub, "request_media");
          mediaIds.push(asset._id);
        }
      }
    } else {
      body = await readJson(req);
    }

    const categoryId = String(body.categoryId || "");
    if (!categoryId) throw new ApiError("Service category is required", 400);
    const category = await ServiceCategory.findById(categoryId);
    if (!category) throw new ApiError("Category not found", 404);
    if (!body.title || String(body.title).trim().length < 4) throw new ApiError("Job title is required (min 4 chars)", 400);
    if (!body.description || String(body.description).trim().length < 10) {
      throw new ApiError("Problem description is required (min 10 chars)", 400);
    }
    const urgency = (body.urgency as Urgency) || "normal";
    if (!URGENCY.includes(urgency)) throw new ApiError("Invalid urgency", 400);

    const addressId = body.addressId ? String(body.addressId) : "";
    let location: Record<string, unknown> = {};
    if (addressId) {
      const addr = await Address.findOne({ _id: addressId, userId: session.sub }).lean();
      if (!addr) throw new ApiError("Address not found", 404);
      location = {
        addressId: addr._id,
        label: addr.label,
        region: addr.region,
        city: addr.city,
        woreda: addr.woreda,
        subCity: addr.subCity,
        area: addr.area,
        street: addr.street,
        latitude: addr.latitude,
        longitude: addr.longitude,
        instructions: String(body.accessInstructions || ""),
      };
    } else {
      location = {
        label: String(body.locationLabel || "Job site"),
        region: String(body.region || ""),
        city: String(body.city || ""),
        woreda: String(body.woreda || ""),
        area: String(body.area || ""),
        latitude: body.latitude ? Number(body.latitude) : null,
        longitude: body.longitude ? Number(body.longitude) : null,
        instructions: String(body.accessInstructions || ""),
      };
      if (!location.city) throw new ApiError("Job location (city) is required", 400);
    }

    const request = await ServiceRequest.create({
      reference: ref(),
      customerId: session.sub,
      categoryId,
      subCategoryId: body.subCategoryId ? new mongoose.Types.ObjectId(String(body.subCategoryId)) : null,
      title: String(body.title).trim(),
      description: String(body.description).trim(),
      urgency,
      location,
      mediaFileIds: mediaIds as mongoose.Types.ObjectId[],
      measurements: String(body.measurements || ""),
      requiredMaterials: String(body.requiredMaterials || ""),
      accessInstructions: String(body.accessInstructions || ""),
      specialInstructions: String(body.specialInstructions || ""),
      preferredDate: body.preferredDate ? new Date(String(body.preferredDate)) : null,
      preferredTime: String(body.preferredTime || ""),
      budget: Number(body.budget || 0),
      preferredWorkerId: body.preferredWorkerId
        ? new mongoose.Types.ObjectId(String(body.preferredWorkerId))
        : null,
      recurring: {
        enabled: body.recurring === "true" || body.recurring === true,
        interval: String(body.recurringInterval || "none") as "none" | "weekly" | "monthly" | "quarterly",
      },
      expiresAt: new Date(Date.now() + 7 * 86400000),
      status: "open",
    });

    const candidates = await WorkerProfile.find({
      status: "approved",
      $or: [{ categoryIds: categoryId }, { profession: new RegExp(category.name, "i") }],
    })
      .select("userId")
      .limit(50)
      .lean();
    await notifyMany(
      candidates.map((c) => c.userId),
      {
        type: "new_request",
        title: "New service request near you",
        body: `${request.title} (${request.urgency}) in ${request.location.city || "your area"}.`,
        link: "/dashboard/worker/requests",
        category: "booking",
      }
    );
    if (request.preferredWorkerId) {
      await notifyMany([request.preferredWorkerId], {
        type: "new_request",
        title: "Customer requested you specifically",
        body: `${request.title}`,
        link: "/dashboard/worker/requests",
        category: "booking",
      });
    }

    await logAudit(session, "request_created", `Service request ${request.reference} created`, {
      entity: "ServiceRequest",
      entityId: request._id.toString(),
    });

    return ok({ request });
  });
}
