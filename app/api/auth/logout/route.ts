import { clearSessionCookie, getSession } from "@/lib/auth";
import { handle, ok } from "@/lib/http";
import { logAudit } from "@/lib/services/audit";

export async function POST() {
  return handle(async () => {
    const session = await getSession();
    await clearSessionCookie();
    if (session) await logAudit(session, "logout", `${session.email} logged out`);
    return ok({ loggedOut: true });
  });
}
