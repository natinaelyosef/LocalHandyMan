import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import mongoose from "mongoose";
import { connectDB } from "../db";
import { FileAsset, Conversation, Booking } from "../models";
import type { SessionPayload } from "../auth";
import { ApiError } from "../http";

const UPLOAD_DIR = path.join(process.cwd(), process.env.UPLOAD_DIR || ".data/uploads");
const MAX_BYTES = Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024;

const ALLOWED: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "application/pdf": [".pdf"],
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "application/msword": [".doc"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "text/plain": [".txt"],
};

export type FileKind =
  | "avatar"
  | "worker_document"
  | "portfolio"
  | "request_media"
  | "work_evidence"
  | "payment_proof"
  | "message"
  | "review"
  | "dispute_evidence";

export async function saveUpload(file: File, uploaderId: string, kind: FileKind) {
  if (!file || typeof file === "string" || file.size === 0) {
    throw new ApiError("No file provided", 400);
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED[mime]) throw new ApiError(`File type not allowed: ${mime}`, 400);
  if (file.size > MAX_BYTES) throw new ApiError(`File exceeds ${MAX_BYTES / 1024 / 1024}MB limit`, 400);

  await connectDB();
  const id = new mongoose.Types.ObjectId();
  const ext = ALLOWED[mime][0];
  const storedName = `${id.toHexString()}${ext}`;
  const safeOriginal = (file.name || "file").replace(/[^\w.\-]+/g, "_").slice(0, 120);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(UPLOAD_DIR, storedName), buffer);

  const asset = await FileAsset.create({
    _id: id,
    uploaderId,
    kind,
    originalName: safeOriginal,
    storedName,
    mime,
    size: file.size,
  });
  return asset;
}

export async function deleteUpload(fileId: string) {
  if (!mongoose.Types.ObjectId.isValid(fileId)) return;
  await connectDB();
  const asset = await FileAsset.findById(fileId);
  if (!asset) return;
  await fs.unlink(path.join(UPLOAD_DIR, asset.storedName)).catch(() => undefined);
  await asset.deleteOne();
}

export async function readUpload(fileId: string) {
  if (!mongoose.Types.ObjectId.isValid(fileId)) throw new ApiError("Invalid file id", 400);
  await connectDB();
  const asset = await FileAsset.findById(fileId);
  if (!asset) throw new ApiError("File not found", 404);
  const filePath = path.join(UPLOAD_DIR, asset.storedName);
  try {
    const buffer = await fs.readFile(filePath);
    return { asset, buffer };
  } catch {
    throw new ApiError("File content missing",  404);
  }
}

export type Viewer = SessionPayload | null;

async function isBookingParticipant(bookingId: mongoose.Types.ObjectId, userId: string) {
  const booking = await Booking.findById(bookingId)
    .select("customerId workerId")
    .lean<{ customerId: mongoose.Types.ObjectId; workerId: mongoose.Types.ObjectId } | null>();
  if (!booking) return false;
  return booking.customerId.toString() === userId || booking.workerId.toString() === userId;
}

/**
 * Access rules for sensitive files. Payment proofs and worker documents are never public.
 */
export async function assertFileAccess(fileId: string, viewer: Viewer): Promise<boolean> {
  if (!mongoose.Types.ObjectId.isValid(fileId)) throw new ApiError("Invalid file id", 400);
  await connectDB();
  const asset = await FileAsset.findById(fileId);
  if (!asset) throw new ApiError("File not found", 404);

  const isAdmin = viewer?.role === "admin";
  if (isAdmin) return true;

  const isOwner = viewer?.sub === asset.uploaderId.toString();
  const publicKinds: FileKind[] = ["avatar", "portfolio", "review"];
  if (publicKinds.includes(asset.kind)) return true;
  if (!viewer) throw new ApiError("Not authorized to view this file", 403);

  if (asset.kind === "worker_document") return isOwner;

  if (asset.kind === "message" && asset.entityId) {
    const convo = await Conversation.findById(asset.entityId).select("participants").lean();
    if (!convo) return false;
    const allowed = convo.participants.map((p) => p.toString()).includes(viewer.sub);
    if (allowed) return true;
    throw new ApiError("Not authorized to view this file", 403);
  }

  if ((asset.kind === "payment_proof" || asset.kind === "work_evidence") && asset.entityId) {
    if (await isBookingParticipant(asset.entityId, viewer.sub)) return true;
    const booking = await Booking.findById(asset.entityId).select("requestId").lean();
    if (booking) {
      const { ServiceRequest } = await import("../models");
      const req = await ServiceRequest.findById(booking.requestId)
        .select("customerId invitedWorkerIds")
        .lean();
      if (
        req &&
        (req.customerId.toString() === viewer.sub ||
          (req.invitedWorkerIds || []).some((w) => w.toString() === viewer.sub))
      ) {
        return true;
      }
    }
  }

  if (asset.kind === "dispute_evidence" && asset.entityId) {
    const { Dispute } = await import("../models");
    const dispute = await Dispute.findById(asset.entityId).select("raisedBy againstUserId").lean();
    if (!dispute) throw new ApiError("Not authorized to view this file", 403);
    const allowed =
      dispute.raisedBy.toString() === viewer.sub || dispute.againstUserId.toString() === viewer.sub;
    if (allowed) return true;
    throw new ApiError("Not authorized to view this file", 403);
  }

  if (asset.kind === "request_media" && asset.entityId) {
    const { ServiceRequest } = await import("../models");
    const req = await ServiceRequest.findById(asset.entityId)
      .select("customerId invitedWorkerIds")
      .lean();
    if (!req) throw new ApiError("Not authorized to view this file", 403);
    const allowed =
      req.customerId.toString() === viewer.sub ||
      (req.invitedWorkerIds || []).some((w) => w.toString() === viewer.sub);
    if (allowed) return true;
    throw new ApiError("Not authorized to view this file", 403);
  }

  if (isOwner) return true;
  throw new ApiError("Not authorized to view this file", 403);
}

export function randomToken() {
  return crypto.randomBytes(8).toString("hex");
}
