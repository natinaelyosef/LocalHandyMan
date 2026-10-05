import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { handle, ok, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { saveUpload, type FileKind } from "@/lib/services/files";

const KINDS: FileKind[] = [
  "avatar",
  "worker_document",
  "portfolio",
  "request_media",
  "work_evidence",
  "payment_proof",
  "message",
  "review",
  "dispute_evidence",
];

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const form = await req.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") || "request_media") as FileKind;
    if (!KINDS.includes(kind)) throw new ApiError("Invalid file kind", 400);
    if (!file || typeof file === "string") throw new ApiError("File is required", 400);
    await connectDB();
    const asset = await saveUpload(file, session.sub, kind);
    return ok({ fileId: asset._id, name: asset.originalName, mime: asset.mime, size: asset.size, url: `/api/uploads/${asset._id}` });
  });
}
