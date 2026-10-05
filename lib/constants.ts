export const ROLES = ["customer", "worker", "admin"] as const;
export type Role = (typeof ROLES)[number];

export const URGENCY = ["normal", "urgent", "emergency"] as const;
export type Urgency = (typeof URGENCY)[number];

export const BOOKING_STATUSES = [
  "REQUESTED",
  "QUOTATION_SENT",
  "QUOTATION_ACCEPTED",
  "BOOKING_CONFIRMED",
  "ADVANCE_PAYMENT_DUE",
  "PAYMENT_PROOF_SUBMITTED",
  "PAYMENT_VERIFIED",
  "SCHEDULED",
  "WORKER_ON_THE_WAY",
  "WORK_STARTED",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "READY_FOR_REVIEW",
  "COMPLETED",
  "CUSTOMER_CONFIRMED",
  "CLOSED",
  "CANCELLED",
  "REJECTED",
  "DISPUTED",
  "EXPIRED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const TERMINAL_BOOKING_STATUSES: BookingStatus[] = ["CLOSED", "CANCELLED", "REJECTED", "EXPIRED"];

export const PAYMENT_PHASE_STATUSES = [
  "UNPAID",
  "PAYMENT_DUE",
  "PROOF_SUBMITTED",
  "UNDER_VERIFICATION",
  "VERIFIED",
  "REJECTED",
  "CANCELLED",
] as const;
export type PaymentPhaseStatus = (typeof PAYMENT_PHASE_STATUSES)[number];

export const JOB_PHASE_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "COMPLETED",
  "CANCELLED",
] as const;
export type JobPhaseStatus = (typeof JOB_PHASE_STATUSES)[number];

export const WORKER_STATUSES = ["pending", "approved", "rejected", "suspended", "resubmit_required"] as const;
export type WorkerStatus = (typeof WORKER_STATUSES)[number];

export const AVAILABILITY = ["available", "busy", "away", "offline"] as const;
export type Availability = (typeof AVAILABILITY)[number];

export const REJECT_REASONS = [
  "Amount incorrect",
  "Screenshot unclear",
  "Wrong transaction reference",
  "Wrong receiver account",
  "Duplicate proof",
  "Other",
] as const;

export const COMPLAINT_CATEGORIES = [
  "Worker did not arrive",
  "Late arrival",
  "Poor quality",
  "Incomplete work",
  "Wrong price",
  "Property damage",
  "Unprofessional behavior",
  "Payment issue",
  "Other",
] as const;

export const DISPUTE_STATUSES = [
  "open",
  "under_review",
  "awaiting_response",
  "resolved",
  "rejected",
  "closed",
] as const;
export type DisputeStatus = (typeof DISPUTE_STATUSES)[number];

/** Statuses that still require a response or decision from somebody. */
export const OPEN_DISPUTE_STATUSES: DisputeStatus[] = ["open", "under_review", "awaiting_response"];

export const DISPUTE_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type DisputePriority = (typeof DISPUTE_PRIORITIES)[number];

export const DISPUTE_OUTCOMES = [
  "refund_customer",
  "pay_worker",
  "partial_refund",
  "rework",
  "no_action",
  "other",
] as const;
export type DisputeOutcome = (typeof DISPUTE_OUTCOMES)[number];

/** Which dispute statuses each role is allowed to move a case into. */
export const DISPUTE_TRANSITIONS: Record<DisputeStatus, DisputeStatus[]> = {
  open: ["under_review", "awaiting_response", "resolved", "rejected"],
  under_review: ["awaiting_response", "resolved", "rejected"],
  awaiting_response: ["under_review", "resolved", "rejected"],
  resolved: ["closed", "under_review"],
  rejected: ["closed", "under_review"],
  closed: [],
};

/** Booking statuses a dispute may be raised against. */
export const DISPUTABLE_BOOKING_STATUSES: BookingStatus[] = [
  "ADVANCE_PAYMENT_DUE",
  "PAYMENT_PROOF_SUBMITTED",
  "PAYMENT_VERIFIED",
  "SCHEDULED",
  "WORKER_ON_THE_WAY",
  "WORK_STARTED",
  "IN_PROGRESS",
  "AWAITING_CUSTOMER",
  "READY_FOR_REVIEW",
  "COMPLETED",
  "CUSTOMER_CONFIRMED",
  "CLOSED",
];

export function canDisputeTransition(from: DisputeStatus, to: DisputeStatus): boolean {
  if (from === to) return false;
  return (DISPUTE_TRANSITIONS[from] || []).includes(to);
}

export const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Central Ethiopia",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "South Ethiopia",
  "South West Ethiopia",
  "Somali",
  "Tigray",
] as const;

export const PROFESSIONS = [
  "Electrician",
  "Plumber",
  "Cleaner",
  "Carpenter",
  "Painter",
  "Mason",
  "Weldor",
  "Tiler",
  "Roofer",
  "Gardener",
  "Mechanic",
  "Furniture repairer",
  "Appliance repairer",
  "Refrigerator technician",
  "Washing-machine technician",
  "TV technician",
  "Computer technician",
  "Network technician",
  "CCTV installer",
  "Generator technician",
  "Solar installer",
  "HVAC/AC technician",
  "Construction worker",
  "Handyman",
  "Other",
] as const;

export const CURRENCY = "ETB";

export const PAYMENT_METHOD_LABEL = "Manual CBE transfer";
export const PLATFORM_DISCLAIMER =
  "Local Handyman does not process, receive or hold any money. Customers pay workers directly through Commercial Bank of Ethiopia (CBE) and submit proof here for manual verification.";
