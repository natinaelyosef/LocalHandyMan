import { connectDB } from "../db";
import { ApiError } from "../http";

/**
 * RFC 4180 CSV serialisation. Values are always quoted and inner quotes are
 * doubled; a leading =, +, - or @ is prefixed with a tab so spreadsheets treat
 * the cell as text rather than a formula (CSV injection).
 */
export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '""';
    let s = String(value);
    if (/^[=+\-@\t\r]/.test(s)) s = `\t${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  return [headers, ...rows].map((r) => r.map(escape).join(",")).join("\r\n");
}

export function csvResponse(filename: string, csv: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}-${stamp}.csv"`,
      "Cache-Control": "no-store",
      // Belt and braces for spreadsheet formula injection.
      "X-Content-Type-Options": "nosniff",
    },
  });
}

/** Resolves `?from`/`?to` (YYYY-MM-DD) into Date objects, defaulting to 90 days. */
export function dateRange(fromKey?: string | null, toKey?: string | null) {
  const to = toKey ? new Date(`${toKey}T23:59:59.999Z`) : new Date();
  const from =
    fromKey && !isNaN(new Date(`${fromKey}T00:00:00.000Z`).getTime())
      ? new Date(`${fromKey}T00:00:00.000Z`)
      : new Date(to.getTime() - 90 * 86400000);
  if (from > to) throw new ApiError("'from' must be earlier than 'to'", 400);
  return { from, to };
}

/** Formats a date as YYYY-MM-DD in UTC for CSV output. */
export function isoDay(d?: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  return isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

export async function requireReportDB() {
  await connectDB();
}
