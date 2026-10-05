import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { connectDB } from "./db";
import { User } from "./models/User";
import type { Role } from "./constants";

const SECRET = process.env.JWT_SECRET || "dev_only_change_me";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";
export const SESSION_COOKIE = "hhc_token";

export interface SessionPayload {
  sub: string;
  role: Role;
  email: string;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: SessionPayload): string {
  return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN } as jwt.SignOptions);
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET) as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const store = await cookies();
  store.set(SESSION_COOKIE, signToken(payload), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  await connectDB();
  const user = await User.findById(payload.sub).select("status role").lean();
  if (!user || user.status === "disabled") return null;
  return payload;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export async function requireAuth(roles?: Role[]): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) throw new AuthError("Authentication required", 401);
  if (roles && !roles.includes(session.role)) throw new AuthError("Not authorized for this action", 403);
  return session;
}
