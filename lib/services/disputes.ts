import { Types } from "mongoose";
import { connectDB } from "../db";
import { User } from "../models";

/**
 * Builds the dashboard URL a notification recipient should follow.
 *
 * The link has to be resolved from the *recipient's* role, not the sender's:
 * when an admin replies to a case, the recipient is a customer or a worker and
 * must land in their own dashboard. Deriving it from the acting session would
 * send them to the admin's case view.
 */
export async function disputeInboxLink(
  recipientId: string | Types.ObjectId,
  disputeId: string | Types.ObjectId
): Promise<string> {
  await connectDB();
  const user = await User.findById(recipientId).select("role").lean<{ role?: string } | null>();
  const role = user?.role;
  if (role === "customer") return `/dashboard/customer/disputes/${disputeId}`;
  if (role === "worker") return `/dashboard/worker/disputes/${disputeId}`;
  return `/dashboard/admin/disputes/${disputeId}`;
}

/** The other party on a dispute, given who is acting. */
export function counterpartOf(
  dispute: { raisedBy: Types.ObjectId; againstUserId: Types.ObjectId },
  actorId: string
): Types.ObjectId {
  return dispute.raisedBy.toString() === actorId ? dispute.againstUserId : dispute.raisedBy;
}
