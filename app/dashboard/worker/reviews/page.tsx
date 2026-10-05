"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Star, StarHalf } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { WORKER_NAV } from "@/components/dashboard/nav-config";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { api, fileUrl, fmtDate } from "@/lib/client";
import { useLocale } from "@/context/locale";
import { EmptyState, ErrorState, PageSkeleton, useErrMsg } from "../_shared";

type ReviewItemT = {
  _id: string;
  overall: number;
  quality?: number;
  communication?: number;
  punctuality?: number;
  professionalism?: number;
  text?: string;
  workerReply?: string;
  createdAt: string;
  customerId: { name: string; avatarFileId?: string | null };
  bookingId?: string | { _id: string };
};

type SummaryT = {
  avg: number;
  n: number;
  quality: number;
  communication: number;
  punctuality: number;
  professionalism: number;
};

type RespT = {
  items: ReviewItemT[];
  total: number;
  summary: SummaryT | null;
};

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const filled = value >= i;
        const half = !filled && value >= i - 0.5;
        return filled ? (
          <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ) : half ? (
          <StarHalf key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
        ) : (
          <Star key={i} className="h-4 w-4 text-muted-foreground/40" />
        );
      })}
    </span>
  );
}

export default function WorkerReviewsPage() {
  const { t } = useLocale();
  const errMsg = useErrMsg();
  const [data, setData] = useState<RespT | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<RespT>("/api/reviews?workerId=me&limit=50");
      setData(d);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }, [errMsg]);

  useEffect(() => {
    load();
  }, [load]);

  const computed = useMemo<SummaryT>(() => {
    const items = data?.items || [];
    const n = items.length;
    const avg = (k: keyof ReviewItemT) =>
      n ? items.reduce((s, r) => s + Number(r[k] || 0), 0) / n : 0;
    return {
      avg: avg("overall"),
      n,
      quality: avg("quality"),
      communication: avg("communication"),
      punctuality: avg("punctuality"),
      professionalism: avg("professionalism"),
    };
  }, [data]);

  const summary: SummaryT =
    data && data.summary && data.summary.n === data.total ? data.summary : computed;

  const breakdown: { label: string; value: number }[] = [
    { label: t("worker.reviews.quality"), value: summary.quality },
    { label: t("worker.reviews.communication"), value: summary.communication },
    { label: t("worker.reviews.punctuality"), value: summary.punctuality },
    { label: t("worker.reviews.professionalism"), value: summary.professionalism },
  ];

  const bookingRef = (id?: string | { _id: string }) => (typeof id === "string" ? id : id?._id);

  return (
    <DashboardShell role="worker" nav={WORKER_NAV} title={t("nav.reviews")} subtitle={t("worker.reviews.subtitle")}>
      <div className="mx-auto max-w-5xl space-y-6">
        {loading && <PageSkeleton rows={3} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}

        {!loading && !error && data && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card>
                <CardContent className="flex items-center gap-5 p-5">
                  <div className="text-center">
                    <p className="text-5xl font-bold tracking-tight">{(summary.avg || 0).toFixed(1)}</p>
                    <div className="mt-1">
                      <Stars value={summary.avg || 0} />
                    </div>
                  </div>
                  <div className="border-l pl-5">
                    <p className="text-2xl font-semibold">{summary.n}</p>
                    <p className="text-sm text-muted-foreground">
                      {summary.n === 1 ? t("worker.reviews.receivedOne") : t("worker.reviews.receivedMany")}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="space-y-3 p-5">
                  {breakdown.map((b) => (
                    <div key={b.label}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">{b.label}</span>
                        <span className="font-semibold">{(b.value || 0).toFixed(1)}</span>
                      </div>
                      <Progress value={((b.value || 0) / 5) * 100} className="h-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>

            {data.items.length === 0 ? (
              <EmptyState
                icon={Star}
                title={t("worker.reviews.emptyTitle")}
                hint={t("worker.reviews.emptyHint")}
              />
            ) : (
              <div className="space-y-4">
                {data.items.map((r) => (
                  <Card key={r._id}>
                    <CardContent className="space-y-3 p-5">
                      <div className="flex items-start gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={r.customerId?.avatarFileId ? fileUrl(r.customerId.avatarFileId) : ""} />
                          <AvatarFallback>{(r.customerId?.name || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-medium">{r.customerId?.name || t("worker.reviews.customerFallback")}</span>
                            <span className="text-xs text-muted-foreground">{fmtDate(r.createdAt)}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-2">
                            <Stars value={r.overall} />
                            <span className="text-xs font-semibold">{r.overall.toFixed(1)}</span>
                          </div>
                        </div>
                      </div>

                      {r.text && <p className="whitespace-pre-wrap text-sm leading-relaxed">{r.text}</p>}

                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>{t("worker.reviews.quality")} {(r.quality || 0).toFixed(1)}</span>
                        <span>{t("worker.reviews.communication")} {(r.communication || 0).toFixed(1)}</span>
                        <span>{t("worker.reviews.punctuality")} {(r.punctuality || 0).toFixed(1)}</span>
                        <span>{t("worker.reviews.professionalism")} {(r.professionalism || 0).toFixed(1)}</span>
                        {bookingRef(r.bookingId) && (
                          <span className="font-mono">
                            {t("worker.reviews.jobRef", { ref: bookingRef(r.bookingId)?.slice(-6).toUpperCase() || "" })}
                          </span>
                        )}
                      </div>

                      {r.workerReply && (
                        <div className="rounded-lg border bg-muted/50 p-3">
                          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            <MessageSquare className="h-3.5 w-3.5" /> {t("worker.reviews.yourReply")}
                          </p>
                          <p className="whitespace-pre-wrap text-sm">{r.workerReply}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
