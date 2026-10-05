import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { ServiceCategory } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { logAudit } from "@/lib/services/audit";

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function GET() {
  return handle(async () => {
    await connectDB();
    const all = await ServiceCategory.find({ active: true }).sort({ order: 1, name: 1 }).lean();
    const parents = all.filter((c) => !c.parent);
    const tree = parents.map((p) => ({ ...p, children: all.filter((c) => String(c.parent) === String(p._id)) }));
    return ok({ categories: all, tree });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["admin"]);
    const body = await readJson<{ name?: string; description?: string; icon?: string; parent?: string; order?: number; tags?: string[] }>(req);
    if (!body.name) throw new ApiError("Category name is required", 400);
    await connectDB();
    const slug = slugify(body.name);
    const exists = await ServiceCategory.findOne({ slug });
    if (exists) throw new ApiError("A category with this name already exists", 409);
    const cat = await ServiceCategory.create({
      name: body.name,
      slug,
      description: body.description || "",
      icon: body.icon || "",
      parent: body.parent || null,
      order: body.order ?? 0,
      tags: body.tags || [],
    });
    await logAudit(session, "category_created", `Category "${cat.name}" created`, { entity: "ServiceCategory", entityId: cat._id.toString() });
    return ok(cat);
  });
}
