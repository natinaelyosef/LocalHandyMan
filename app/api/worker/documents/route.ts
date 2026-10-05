import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { WorkerProfile } from "@/lib/models";
import { handle, ok, ApiError } from "@/lib/http";
import { requireAuth } from "@/lib/auth";
import { saveUpload, deleteUpload } from "@/lib/services/files";
import { logAudit } from "@/lib/services/audit";

const DOC_TYPES = ["id", "skill_certificate", "training_certificate", "experience_evidence", "other"];

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const form = await req.formData();
    const file = form.get("file");
    const type = String(form.get("type") || "");
    const title = String(form.get("title") || "").trim();
    if (!DOC_TYPES.includes(type)) throw new ApiError("Invalid document type", 400);
    if (!title) throw new ApiError("Document title is required", 400);
    if (!file || typeof file === "string") throw new ApiError("File is required", 400);

    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);
    if ((profile.documents?.length || 0) >= 10) throw new ApiError("Document limit reached (10)", 409);

    const asset = await saveUpload(file, session.sub, "worker_document");
    profile.documents = profile.documents || [];
    profile.documents.push({ type, title, fileId: asset._id, status: "pending", reviewNote: "", reviewedAt: null } as never);
    if (["rejected", "resubmit_required"].includes(profile.status)) {
      profile.status = "pending";
      profile.statusNote = "";
    }
    await profile.save();
    await logAudit(session, "worker_document_uploaded", `Worker uploaded document "${title}"`);
    return ok({ documents: profile.documents });
  });
}

export async function DELETE(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth(["worker"]);
    const { searchParams } = new URL(req.url);
    const docId = searchParams.get("id");
    if (!docId) throw new ApiError("Document id is required", 400);
    await connectDB();
    const profile = await WorkerProfile.findOne({ userId: session.sub });
    if (!profile) throw new ApiError("Worker profile not found", 404);
    const doc = (profile.documents || []).find((d) => d._id.toString() === docId);
    if (!doc) throw new ApiError("Document not found", 404);
    if (doc.fileId) await deleteUpload(String(doc.fileId));
    profile.documents = (profile.documents || []).filter((d) => d._id.toString() !== docId) as never;
    await profile.save();
    return ok({ documents: profile.documents });
  });
}
