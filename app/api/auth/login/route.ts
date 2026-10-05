import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { verifyPassword, setSessionCookie } from "@/lib/auth";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { logAudit } from "@/lib/services/audit";

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const { email, password } = await readJson<{ email?: string; password?: string }>(req);
    if (!email || !password) throw new ApiError("Email and password are required", 400);

    await connectDB();
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+passwordHash +loginAttempts +lockedUntil"
    );
    if (!user) throw new ApiError("Invalid email or password", 401);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new ApiError("Account temporarily locked due to failed attempts. Try again later.", 423);
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      if (user.loginAttempts >= MAX_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000);
        user.loginAttempts = 0;
      }
      await user.save();
      throw new ApiError("Invalid email or password", 401);
    }

    if (user.status === "disabled") throw new ApiError("This account has been disabled", 403);
    if (user.status === "suspended") throw new ApiError("This account is suspended. Contact support.", 403);

    user.loginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    await setSessionCookie({ sub: user._id.toString(), role: user.role, email: user.email });
    await logAudit({ sub: user._id.toString(), role: user.role, email: user.email }, "login", `${user.email} logged in`);

    return ok({ id: user._id, role: user.role, name: user.name, email: user.email, phone: user.phone });
  });
}
