import { connectDB } from "../db";
import { AuditLog } from "../models";
import type { SessionPayload } from "../auth";

export async function logAudit(
  actor: Partial<SessionPayload> | null,
  action: string,
  summary: string,
  opts: { entity?: string; entityId?: string; meta?: unknown } = {}
) {
  try {
    await connectDB();
    await AuditLog.create({
      actorId: actor?.sub ?? null,
      actorRole: actor?.role ?? "system",
      actorName: actor?.email ?? "",
      action,
      entity: opts.entity ?? "",
      entityId: opts.entityId ?? "",
      summary,
      meta: opts.meta ?? null,
    });
  } catch (err) {
    console.error("[audit]", err);
  }
}
