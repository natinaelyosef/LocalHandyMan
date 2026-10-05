import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { hashPassword } from "@/lib/auth";
import crypto from "crypto";

const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email } = await readJson<{ email?: string }>(req);
    if (!email) throw new ApiError("Email is required", 400);
    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    const response = {
      message: "If an account exists for this email, a reset code has been generated.",
      resetCode: undefined as string | undefined,
    };
    if (user) {
      const code = crypto.randomInt(100000, 999999).toString();
      user.set("resetTokenHash", crypto.createHash("sha256").update(code).digest("hex"));
      user.set("resetExpires", new Date(Date.now() + 20 * 60000));
      await user.save();
      response.resetCode = code;
    }
    return ok(response);
  });
}

export async function PATCH(req: NextRequest) {
  return handle(async () => {
    const { email, code, password } = await readJson<{ email?: string; code?: string; password?: string }>(req);
    if (!email || !code || !password) throw new ApiError("Email, code and new password are required", 400);
    if (!STRONG.test(password)) {
      throw new ApiError("Password must be 8+ characters with upper, lower and a number", 400);
    }
    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select("+resetTokenHash +resetExpires");
    if (!user || !user.resetTokenHash || !user.resetExpires || user.resetExpires < new Date()) {
      throw new ApiError("Invalid or expired reset code", 400);
    }
    const hash = crypto.createHash("sha256").update(code).digest("hex");
    if (hash !== user.resetTokenHash) throw new ApiError("Invalid reset code", 400);
    user.passwordHash = await hashPassword(password);
    user.resetTokenHash = undefined;
    user.resetExpires = undefined;
    user.loginAttempts = 0;
    user.lockedUntil = null;
    await user.save();
    return ok({ message: "Password updated. You can now log in." });
  });
}
