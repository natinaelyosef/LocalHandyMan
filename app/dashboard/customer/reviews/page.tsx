"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck, Star } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api, fmtDate } from "@/lib/client";
import { useLocale } from "@/context/locale";
import type { BookingLite, ReviewItem } from "@/app/dashboard/customer/_lib/types";
import { rid, rname } from "@/app/dashboard/customer/_lib/types";
import { EmptyState, ErrorState, RowsSkeleton, Stars, errText, useStatusLabel } from "@/app/dashboard/customer/_lib/ui";

export default function MyReviewsPage() {
  const { t } = useLocale();
  const statusLabel = useStatusLabel();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [pending, setPending] = useState<BookingLite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [r, b] = await Promise.all([
        api<{ items: ReviewItem[] }>("/api/reviews?customerId=me&limit=50"),
        api<{ items: BookingLite[] }>("/api/bookings?status=COMPLETED,CUSTOMER_CONFIRMED,CLOSED&limit=50"),
      ]);
      setItems(r.items || []);
      setPending((b.items || []).filter((x) => !x.reviewed));
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardShell
      role="customer"
      nav={CUSTOMER_NAV}
      title={t("nav.myReviews")}
      subtitle={t("customer.reviews.subtitle")}
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {loading && <RowsSkeleton n={4} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && pending.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <h2 className="text-sm font-semibold">{t("customer.reviews.waitingTitle")}</h2>
            </div>
            {pending.map((b) => (
              <div
                key={b._id}
                className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-amber-900 dark:text-amber-200">{b.title}</p>
                  <p className="text-xs text-amber-800 dark:text-amber-300">
                    {b.code} · {t("customer.reviews.completedOn", { date: fmtDate(b.expectedCompletion || b.createdAt) })}
                  </p>
                </div>
                <Button asChild size="sm">
                  <Link href={`/dashboard/customer/bookings/${rid(b)}`}>
                    {t("customer.reviews.leaveReview")} <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            ))}
          </section>
        )}

        {!loading && !error && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">{t("customer.reviews.writtenTitle")}</h2>
              <span className="text-xs text-muted-foreground">
                {t("customer.reviews.totalCount", { n: items.length })}
              </span>
            </div>

            {items.length === 0 ? (
              <EmptyState icon={Star} title={t("customer.reviews.emptyTitle")} message={t("customer.reviews.emptyMsg")}>
                <Button asChild variant="outline">
                  <Link href="/dashboard/customer/bookings">
                    <CalendarCheck className="mr-2 h-4 w-4" /> {t("nav.myBookings")}
                  </Link>
                </Button>
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {items.map((r) => (
                  <article key={r._id} className="rounded-xl border bg-card p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-semibold">{rname(r.workerId, t("customer.workerLabel"))}</span>
                      <Stars value={r.overall} />
                      <span className="text-sm font-bold">{r.overall}/5</span>
                      <Badge variant="secondary" className="ml-auto text-xs">
                        {statusLabel(r.status)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                    </div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                      <Mini label={t("customer.review.dimQuality")} value={Number(r.quality || r.overall)} />
                      <Mini label={t("customer.review.dimCommunication")} value={Number(r.communication || r.overall)} />
                      <Mini label={t("customer.review.dimPunctuality")} value={Number(r.punctuality || r.overall)} />
                      <Mini
                        label={t("customer.review.dimProfessionalism")}
                        value={Number(r.professionalism || r.overall)}
                      />
                    </div>
                    {r.text && <p className="mt-3 whitespace-pre-wrap text-sm text-foreground/90">{r.text}</p>}
                    {r.workerReply && (
                      <div className="mt-3 rounded-lg bg-muted/60 p-3 text-sm">
                        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t("customer.reviews.workerReply")}
                        </span>
                        <p className="mt-1 text-foreground/90">{r.workerReply}</p>
                      </div>
                    )}
                    {r.bookingId && (
                      <Link
                        href={`/dashboard/customer/bookings/${rid(r.bookingId)}`}
                        className="mt-3 inline-block text-xs font-medium text-primary hover:underline"
                      >
                        {t("customer.reviews.viewBooking")}
                      </Link>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </DashboardShell>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}/5</p>
    </div>
  );
}
