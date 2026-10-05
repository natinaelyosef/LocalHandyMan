import { NextRequest } from "next/server";
import { connectDB } from "@/lib/db";
import { User, WorkerProfile, Address } from "@/lib/models";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { handle, ok, readJson, ApiError } from "@/lib/http";
import { ROLES, PROFESSIONS, type Role } from "@/lib/constants";
import { logAudit } from "@/lib/services/audit";

interface RegisterBody {
  role: Role;
  name: string;
  email: string;
  phone: string;
  password: string;
  gender?: string;
  profession?: string;
  headline?: string;
  yearsOfExperience?: number;
  startingPrice?: number;
  region?: string;
  city?: string;
}

const STRONG = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export async function POST(req: NextRequest) {
  return handle(async () => {
    const body = await readJson<RegisterBody>(req);
    const role = body.role;
    if (!ROLES.includes(role)) throw new ApiError("Invalid role", 400);
    if (role === "admin") throw new ApiError("Admin accounts are created by the system", 403);
    if (!body.name || body.name.trim().length < 2) throw new ApiError("Name is required", 400);
    if (!body.email || !/^\S+@\S+\.\S+$/.test(body.email)) throw new ApiError("Valid email is required", 400);
    if (!body.phone || body.phone.trim().length < 6) throw new ApiError("Valid phone number is required", 400);
    if (!body.password || !STRONG.test(body.password)) {
      throw new ApiError("Password must be 8+ characters with upper, lower and a number", 400);
    }
    if (role === "worker" && (!body.profession || !PROFESSIONS.includes(body.profession as never))) {
      throw new ApiError("Choose a profession", 400);
    }

    await connectDB();
    const existing = await User.findOne({ email: body.email.toLowerCase().trim() });
    if (existing) throw new ApiError("An account with this email already exists", 409);

    const user = await User.create({
      role,
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      phone: body.phone.trim(),
      passwordHash: await hashPassword(body.password),
      gender: (body.gender || "") as "" | "male" | "female" | "other",
    });

    await Address.create({
      userId: user._id,
      label: "Home",
      region: body.region || "Addis Ababa",
      city: body.city || "Addis Ababa",
      isDefault: true,
    });

    if (role === "worker") {
      await WorkerProfile.create({
        userId: user._id,
        profession: body.profession as never,
        headline: body.headline || "",
        yearsOfExperience: body.yearsOfExperience ?? 0,
        startingPrice: body.startingPrice ?? 0,
        serviceArea: { region: body.region || "Addis Ababa", city: body.city || "Addis Ababa", radiusKm: 15 },
        status: "pending",
      });
    }

    await setSessionCookie({ sub: user._id.toString(), role: user.role as Role, email: user.email });
    await logAudit(
      { sub: user._id.toString(), role: user.role as Role, email: user.email },
      "register",
      `${role} registered: ${user.email}`
    );

    return ok({
      id: user._id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    });
  });
}
