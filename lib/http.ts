import { NextResponse } from "next/server";
import { AuthError, getSession } from "./auth";
import { connectDB } from "./db";
import mongoose from "mongoose";

export { getSession };

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ ok: true, data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

type Handler = () => Promise<Response> | Response;

export async function handle(fn: Handler): Promise<Response> {
  try {
    await connectDB();
    return await fn();
  } catch (err) {
    if (err instanceof ApiError || err instanceof AuthError) {
      return fail(err.message, err.status);
    }
    if (err instanceof mongoose.Error.ValidationError) {
      const first = Object.values(err.errors)[0];
      return fail(first?.message || "Invalid data", 400);
    }
    if (err instanceof mongoose.Error.CastError) {
      return fail("Invalid identifier", 400);
    }
    console.error("[api]", err);
    return fail("Internal server error", 500);
  }
}

export function assert(condition: unknown, message: string, status = 400): asserts condition {
  if (!condition) throw new ApiError(message, status);
}

export function isValidId(id: string) {
  return mongoose.Types.ObjectId.isValid(id);
}

export function requireValidId(id: string) {
  if (!isValidId(id)) throw new ApiError("Invalid id", 400);
}

export async function readJson<T = Record<string, unknown>>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError("Invalid JSON body", 400);
  }
}
