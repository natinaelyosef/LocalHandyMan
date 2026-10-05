import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { requireAuth, hashPassword, verifyPassword } from "@/lib/auth";
import { saveUpload, deleteUpload } from "@/lib/services/files";
import { logAudit } from "@/lib/services/audit";

export async function GET() {
  return handle(async () => {
    const session = await requireAuth();
    await connectDB();
    const user = await User.findById(session.sub)
      .select("name email phone role gender avatarFileId status preferredLanguage createdAt")
      .lean();
    if (!user) throw new ApiError("User not found", 404);
    return ok({ user });
  });
}

const GENDERS = ["male", "female", "other", ""];
const LANGS = ["en", "am", "om"];

function cleanName(name: unknown): string {
  const v = String(name ?? "").trim().replace(/\s+/g, " ");
  if (v.length < 2) throw new ApiError("Name must be at least 2 characters", 400);
  if (v.length > 80) throw new ApiError("Name is too long", 400);
  return v;
}

function cleanPhone(phone: unknown): string {
  const v = String(phone ?? "").trim().replace(/[\s-]/g, "");
  if (!/^\+?\d{7,15}$/.test(v)) throw new ApiError("Enter a valid phone number", 400);
  return v;
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const contentType = req.headers.get("content-type") || "";
    await connectDB();
    const user = await User.findById(session.sub);
    if (!user) throw new ApiError("User not found", 404);

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const name = form.get("name");
      const phone = form.get("phone");
      const gender = form.get("gender");
      const language = form.get("preferredLanguage");
      if (name !== null && String(name).trim() !== "") user.name = cleanName(name);
      if (phone !== null && String(phone).trim() !== "") user.phone = cleanPhone(phone);
      if (gender !== null && String(gender) !== "") {
        if (!GENDERS.includes(String(gender))) throw new ApiError("Invalid gender", 400);
        user.gender = String(gender) as "" | "male" | "female" | "other";
      }
      if (language !== null && String(language).trim() !== "") {
        if (!LANGS.includes(String(language))) throw new ApiError("Invalid language", 400);
        user.preferredLanguage = String(language) as never;
      }
      const avatar = form.get("avatar");
      if (avatar && typeof avatar !== "string" && avatar.size > 0) {
        if (user.avatarFileId) await deleteUpload(String(user.avatarFileId));
        const asset = await saveUpload(avatar, session.sub, "avatar");
        user.avatarFileId = asset._id;
      }
    } else {
      const body = await readJson<{ name?: string; phone?: string; gender?: string; preferredLanguage?: string }>(req);
      if (body.name !== undefined) user.name = cleanName(body.name);
      if (body.phone !== undefined) user.phone = cleanPhone(body.phone);
      if (body.gender !== undefined && body.gender !== "") {
        if (!GENDERS.includes(body.gender)) throw new ApiError("Invalid gender", 400);
        user.gender = body.gender as "" | "male" | "female" | "other";
      }
      if (body.preferredLanguage !== undefined && body.preferredLanguage !== "") {
        if (!LANGS.includes(body.preferredLanguage)) throw new ApiError("Invalid language", 400);
        user.preferredLanguage = body.preferredLanguage as never;
      }
    }

    await user.save();
    await logAudit(session, "profile_updated", `${user.email} updated profile`);
    return ok({
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        gender: user.gender,
        avatarFileId: user.avatarFileId,
        preferredLanguage: user.preferredLanguage,
      },
    });
  });
}

export async function POST(req: NextRequest) {
  return handle(async () => {
    const session = await requireAuth();
    const { currentPassword, newPassword } = await readJson<{ currentPassword?: string; newPassword?: string }>(req);
    if (!currentPassword || !newPassword) throw new ApiError("Current and new password are required", 400);
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(newPassword)) {
      throw new ApiError("Password must be 8+ characters with upper, lower and a number", 400);
    }
    await connectDB();
    const user = await User.findById(session.sub).select("+passwordHash");
    if (!user) throw new ApiError("User not found", 404);
    if (!(await verifyPassword(currentPassword, user.passwordHash))) {
      throw new ApiError("Current password is incorrect", 400);
    }
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await logAudit(session, "password_changed", `${user.email} changed password`);
    return ok({ message: "Password changed" });
  });
}
