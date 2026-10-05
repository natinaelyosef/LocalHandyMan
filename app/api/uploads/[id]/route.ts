import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { handle, ok, fail, requireValidId } from "@/lib/http";
import { readUpload, assertFileAccess } from "@/lib/services/files";

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await ctx.params;
    requireValidId(id);
    const session = await getSession();
    await assertFileAccess(id, session);
    const { asset, buffer } = await readUpload(id);
    // Stored files are immutable: a new upload always mints a new id and
    // replacing/deleting removes the record, so browsers may cache for a year.
    // The ETag lets repeat views skip the download entirely (304).
    const etag = `"${id}-${asset.size}-${new Date(asset.updatedAt as unknown as string).getTime()}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new Response(null, { status: 304, headers: { ETag: etag } });
    }
    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type": asset.mime,
        "Content-Length": String(buffer.length),
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.originalName)}"`,
        "Cache-Control": "private, max-age=31536000, immutable",
        ETag: etag,
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const session = await getSession();
    if (!session) return fail("Not authenticated", 401);
    const { id } = await ctx.params;
    requireValidId(id);
    const { FileAsset } = await import("@/lib/models");
    const { deleteUpload } = await import("@/lib/services/files");
    const asset = await FileAsset.findById(id);
    if (!asset) return fail("File not found", 404);
    if (asset.uploaderId.toString() !== session.sub && session.role !== "admin") {
      return fail("Not authorized", 403);
    }
    await deleteUpload(id);
    return ok({ deleted: true });
  });
}
