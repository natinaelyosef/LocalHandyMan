export class ClientApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

type Opts = {
  method?: string;
  body?: unknown;
  form?: FormData;
  cache?: RequestCache;
};

export async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;
  if (opts.form) {
    body = opts.form;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(path, {
    method: opts.method || (opts.body || opts.form ? "POST" : "GET"),
    headers,
    body,
    cache: opts.cache || "no-store",
  });
  let json: { ok?: boolean; data?: T; error?: string } = {};
  try {
    json = await res.json();
  } catch {
    /* ignore */
  }
  if (!res.ok || json.ok === false) {
    throw new ClientApiError(json.error || `Request failed (${res.status})`, res.status);
  }
  return json.data as T;
}

export function fileUrl(fileId: unknown): string {
  if (!fileId) return "";
  return `/api/uploads/${typeof fileId === "string" ? fileId : String((fileId as { toString(): string }).toString())}`;
}

/* -------------------------------------------------------------------------- */
/*                     locale-aware formatting (set by LocaleProvider)        */
/* -------------------------------------------------------------------------- */

type Translator = (key: string, vars?: Record<string, string | number>) => string;

/**
 * `lib/client.ts` is a plain module with no React context, but `fmtDate` and
 * `timeAgo` are called from ~20 client components. LocaleProvider registers the
 * active translator here on mount so those helpers follow the chosen language
 * without every call site having to thread `t` through.
 */
let translator: Translator | null = null;
let activeLocale = "en-GB";

export function configureFormatters(t: Translator | null, locale?: string) {
  translator = t;
  if (locale) activeLocale = locale;
}

export function etb(n: number | undefined | null): string {
  if (n === undefined || n === null || isNaN(Number(n))) return "0 ETB";
  return `${Number(n).toLocaleString(activeLocale)} ETB`;
}

export function fmtDate(d: unknown, opts?: Intl.DateTimeFormatOptions): string {
  if (!d) return "—";
  const date = new Date(d as string | number | Date);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(activeLocale, opts || { day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d: unknown): string {
  if (!d) return "—";
  const date = new Date(d as string | number | Date);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleString(activeLocale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(d: unknown): string {
  if (!d) return "";
  const date = new Date(d as string | number | Date);
  if (isNaN(date.getTime())) return "";
  const s = Math.floor((Date.now() - date.getTime()) / 1000);
  const tr = (key: string, vars?: Record<string, string | number>) =>
    translator ? translator(key, vars) : key;
  if (s < 60) return tr("common.timeAgo.now");
  if (s < 3600) return tr("common.timeAgo.minutes", { n: Math.floor(s / 60) });
  if (s < 86400) return tr("common.timeAgo.hours", { n: Math.floor(s / 3600) });
  if (s < 86400 * 7) return tr("common.timeAgo.days", { n: Math.floor(s / 86400) });
  return fmtDate(d);
}

export const STATUS_COLORS: Record<string, string> = {
  REQUESTED: "bg-slate-100 text-slate-700",
  QUOTATION_SENT: "bg-indigo-100 text-indigo-700",
  QUOTATION_ACCEPTED: "bg-indigo-100 text-indigo-700",
  BOOKING_CONFIRMED: "bg-blue-100 text-blue-700",
  ADVANCE_PAYMENT_DUE: "bg-amber-100 text-amber-800",
  PAYMENT_PROOF_SUBMITTED: "bg-amber-100 text-amber-800",
  PAYMENT_VERIFIED: "bg-emerald-100 text-emerald-700",
  SCHEDULED: "bg-blue-100 text-blue-700",
  WORKER_ON_THE_WAY: "bg-cyan-100 text-cyan-700",
  WORK_STARTED: "bg-cyan-100 text-cyan-700",
  IN_PROGRESS: "bg-cyan-100 text-cyan-700",
  AWAITING_CUSTOMER: "bg-violet-100 text-violet-700",
  READY_FOR_REVIEW: "bg-violet-100 text-violet-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CUSTOMER_CONFIRMED: "bg-emerald-100 text-emerald-700",
  CLOSED: "bg-slate-200 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
  REJECTED: "bg-red-100 text-red-700",
  DISPUTED: "bg-red-100 text-red-700",
  EXPIRED: "bg-slate-200 text-slate-500",
  UNPAID: "bg-slate-100 text-slate-600",
  PAYMENT_DUE: "bg-amber-100 text-amber-800",
  PROOF_SUBMITTED: "bg-amber-100 text-amber-800",
  UNDER_VERIFICATION: "bg-amber-100 text-amber-800",
  VERIFIED: "bg-emerald-100 text-emerald-700",
  NOT_STARTED: "bg-slate-100 text-slate-600",
  PENDING: "bg-amber-100 text-amber-800",
  APPROVED: "bg-emerald-100 text-emerald-700",
  visible: "bg-emerald-100 text-emerald-700",
  open: "bg-blue-100 text-blue-700",
  quoted: "bg-indigo-100 text-indigo-700",
  booking_created: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

export function statusClass(status: string): string {
  return STATUS_COLORS[status] || "bg-slate-100 text-slate-700";
}

export const URGENCY_CLASS: Record<string, string> = {
  normal: "bg-slate-100 text-slate-600",
  urgent: "bg-orange-100 text-orange-700",
  emergency: "bg-red-100 text-red-700",
};
