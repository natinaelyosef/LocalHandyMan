import { getSession } from "@/lib/auth";
import { handle, ok, fail } from "@/lib/http";
import { connectDB } from "@/lib/db";
import { User, WorkerProfile, Address } from "@/lib/models";

export async function GET() {
  return handle(async () => {
    const session = await getSession();
    if (!session) return fail("Not authenticated", 401);
    await connectDB();
    const user = await User.findById(session.sub)
      .select("name email phone role gender avatarFileId status preferredLanguage createdAt")
      .lean();
    if (!user) return fail("User not found", 404);
    const [worker, addresses] = await Promise.all([
      user.role === "worker" ? WorkerProfile.findOne({ userId: user._id }).lean() : null,
      Address.find({ userId: user._id }).sort({ isDefault: -1, createdAt: 1 }).lean(),
    ]);
    return ok({ user, worker, addresses, session: { role: session.role } });
  });
}
