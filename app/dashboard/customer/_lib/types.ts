import { fileUrl } from "@/lib/client";

export type PopRef =
  | string
  | { _id?: string; name?: string; avatarFileId?: string | null; phone?: string; email?: string };

export function rid(v: PopRef | null | undefined): string {
  if (!v) return "";
  if (typeof v === "string") return v;
  return v._id ? String(v._id) : "";
}

export function rname(v: PopRef | null | undefined, fallback = ""): string {
  if (!v || typeof v === "string") return fallback;
  return v.name || fallback;
}

export function ravatar(v: PopRef | null | undefined): string {
  if (!v || typeof v === "string") return "";
  return v.avatarFileId ? fileUrl(v.avatarFileId) : "";
}

export function ratingOf(stats?: { ratingSum?: number; ratingCount?: number } | null): number {
  if (!stats || !stats.ratingCount) return 0;
  return Math.round(((stats.ratingSum || 0) / stats.ratingCount) * 10) / 10;
}

export type Category = {
  _id: string;
  name: string;
  slug?: string;
  icon?: string;
  parent?: string | null;
  description?: string;
};

export type Address = {
  _id: string;
  label: string;
  region: string;
  city: string;
  woreda?: string;
  subCity?: string;
  area?: string;
  street?: string;
  notes?: string;
  isDefault?: boolean;
};

export type Loc = {
  label?: string;
  region?: string;
  city?: string;
  woreda?: string;
  subCity?: string;
  area?: string;
  street?: string;
  instructions?: string;
};

export type ReqStatus = "open" | "quoted" | "booking_created" | "cancelled" | "expired";

export type ServiceRequest = {
  _id: string;
  reference: string;
  title: string;
  description: string;
  urgency: string;
  status: ReqStatus;
  categoryId: PopRef;
  subCategoryId?: PopRef | null;
  location: Loc;
  mediaFileIds?: string[];
  measurements?: string;
  requiredMaterials?: string;
  accessInstructions?: string;
  specialInstructions?: string;
  preferredDate?: string | null;
  preferredTime?: string;
  budget?: number;
  createdAt: string;
  bookingId?: PopRef | null;
  customerId?: PopRef;
  preferredWorkerId?: PopRef | null;
  expiresAt?: string | null;
};

export type Quotation = {
  _id: string;
  requestId?: string;
  source?: string;
  workerId: PopRef;
  laborCost: number;
  materialsCost: number;
  transportCost: number;
  otherCost: number;
  total: number;
  estimatedDuration?: string;
  proposedStartDate?: string | null;
  proposedEndDate?: string | null;
  warrantyDays?: number;
  paymentPlan?: { label: string; percent: number }[];
  notes?: string;
  status: "pending" | "accepted" | "rejected" | "withdrawn" | "changes_requested";
  customerNote?: string;
  createdAt: string;
  responseMinutes?: number | null;
  bookingId?: PopRef | null;
};

export type PaymentSummary = { total: number; verified: number; pending: number; remaining: number };

export type BookingLite = {
  _id: string;
  code: string;
  title: string;
  status: string;
  urgency?: string;
  agreedTotal: number;
  progressPercent: number;
  reviewed?: boolean;
  createdAt: string;
  startDate?: string | null;
  expectedCompletion?: string | null;
  customerId?: PopRef;
  workerId: PopRef;
  paymentSummary?: PaymentSummary;
  location?: Loc;
  conversationId?: PopRef | null;
};

export type JobPhase = {
  _id: string;
  order: number;
  name: string;
  description?: string;
  amount?: number;
  status: string;
  startDate?: string | null;
  dueDate?: string | null;
  notes?: string;
  startedAt?: string | null;
  completedAt?: string | null;
  percent?: number;
  evidence?: { before?: string[]; during?: string[]; after?: string[] };
};

export type PaymentAccount = {
  _id?: string;
  bank: string;
  accountName: string;
  accountNumber: string;
  branch?: string;
  instructions?: string;
};

export type Proof = {
  _id: string;
  reference: string;
  amountPaid: number;
  requiredAmount: number;
  bank?: string;
  senderName: string;
  senderAccount?: string;
  receiverAccount?: string;
  paidAt: string;
  note?: string;
  screenshotFileId: string;
  status: "pending" | "verified" | "rejected";
  rejectionReason?: string;
  reviewedAt?: string | null;
  duplicateFlag?: boolean;
  underpaidBy?: number;
  overpaidBy?: number;
  history?: { at: string; status: string; note?: string; actorRole?: string }[];
};

export type PaymentPhase = {
  _id: string;
  order: number;
  label: string;
  purpose?: string;
  amount: number;
  paidVerified?: number;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  paymentAccountId?: PaymentAccount | string | null;
  proof?: Proof | null;
  rejectionReason?: string;
  verifiedAt?: string | null;
  history?: { at: string; status: string; note?: string; actorRole?: string }[];
};

export type TimelineEntry = {
  at: string;
  action: string;
  note?: string;
  from?: string;
  to?: string;
  actorRole?: string;
};

export type RequestSnapshot = {
  _id?: string;
  title?: string;
  description?: string;
  mediaFileIds?: string[];
  measurements?: string;
  requiredMaterials?: string;
  accessInstructions?: string;
  specialInstructions?: string;
  preferredDate?: string | null;
  preferredTime?: string;
  urgency?: string;
};

export type BookingDetail = {
  booking: BookingLite & {
    allowedTransitions?: Record<string, string[]>;
    timeline?: TimelineEntry[];
    warrantyDays?: number;
    disputeOpen?: boolean;
    description?: string;
  };
  jobPhases: JobPhase[];
  paymentPhases: PaymentPhase[];
  quotation: Quotation | null;
  request: RequestSnapshot | null;
  conversation: { _id: string; lastMessage?: string; lastMessageAt?: string | null } | null;
  accounts: PaymentAccount[];
  viewer: { role: string; id: string };
};

export type ReviewItem = {
  _id: string;
  bookingId?: PopRef;
  workerId: PopRef;
  customerId?: PopRef;
  overall: number;
  quality?: number;
  communication?: number;
  punctuality?: number;
  professionalism?: number;
  text?: string;
  status: string;
  createdAt: string;
  workerReply?: string;
};

export type FavoriteWorker = {
  _id: string;
  userId: PopRef;
  profession: string;
  headline?: string;
  serviceArea?: { city?: string; region?: string };
  stats?: { ratingSum?: number; ratingCount?: number; jobsCompleted?: number };
  availability?: string;
  startingPrice?: number;
};

export type PaymentHistoryRow = { phase: PaymentPhase; booking: BookingLite | null; proofs: Proof[] };
export type PaymentTotals = { required: number; verified: number; pending: number; remaining: number };
