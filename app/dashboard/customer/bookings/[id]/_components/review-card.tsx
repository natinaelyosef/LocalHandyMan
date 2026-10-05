"use client";

import { useEffect, useState } from "react";
import { Loader2, MessageSquare, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { api, fmtDate } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { BookingDetail, ReviewItem } from "@/app/dashboard/customer/_lib/types";
import { rid, rname } from "@/app/dashboard/customer/_lib/types";
import { FieldError, Stars, errText } from "@/app/dashboard/customer/_lib/ui";

const DIMENSIONS: { key: "quality" | "communication" | "punctuality" | "professionalism"; labelKey: string }[] = [
  { key: "quality", labelKey: "customer.review.dimQuality" },
  { key: "communication", labelKey: "customer.review.dimCommunication" },
  { key: "punctuality", labelKey: "customer.review.dimPunctuality" },
  { key: "professionalism", labelKey: "customer.review.dimProfessionalism" },
];

const REVIEWABLE = ["COMPLETED", "CUSTOMER_CONFIRMED", "CLOSED"];

export function ReviewCard({ data, reload }: { data: BookingDetail; reload: () => void }) {
  const { booking } = data;
  const { toast } = useToast();
  const { t } = useLocale();
  const eligible = REVIEWABLE.includes(booking.status) && !booking.reviewed;

  const [existing, setExisting] = useState<ReviewItem | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);
  const [overall, setOverall] = useState(0);
  const [dims, setDims] = useState<Record<string, number>>({});
  const [text, setText] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!booking.reviewed) return;
    let alive = true;
    setLoadingExisting(true);
    api<{ items: ReviewItem[] }>("/api/reviews?customerId=me&limit=50")
      .then((d) => {
        if (!alive) return;
        const found = (d.items || []).find((r) => rid(r.bookingId) === booking._id) || null;
        setExisting(found);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingExisting(false);
      });
    return () => {
      alive = false;
    };
  }, [booking.reviewed, booking._id]);

  if (!eligible && !booking.reviewed) return null;

  if (booking.reviewed) {
    return (
      <div className="rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">{t("customer.review.yourReview")}</h3>
        </div>
        {loadingExisting && (
          <div className="mt-4 space-y-2">
            <div className="h-4 w-40 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
          </div>
        )}
        {!loadingExisting && existing && (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Stars value={existing.overall} size="h-5 w-5" />
              <span className="text-lg font-bold">{existing.overall}/5</span>
              <span className="text-xs text-muted-foreground">
                {t("customer.review.forWorker", { name: rname(existing.workerId, t("customer.yourWorker")) })}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{fmtDate(existing.createdAt)}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {DIMENSIONS.map((d) => (
                <div key={d.key} className="rounded-lg bg-muted/50 p-2.5">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t(d.labelKey)}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Stars value={Number(existing[d.key] || existing.overall)} />
                    <span className="text-sm font-medium">{Number(existing[d.key] || existing.overall)}</span>
                  </div>
                </div>
              ))}
            </div>
            {existing.text && <p className="whitespace-pre-wrap text-sm text-foreground/90">{existing.text}</p>}
          </div>
        )}
        {!loadingExisting && !existing && (
          <p className="mt-2 text-sm text-muted-foreground">{t("customer.review.moderating")}</p>
        )}
      </div>
    );
  }

  const submit = async () => {
    if (overall < 1 || overall > 5) {
      setErr(t("customer.review.ratingError"));
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await api(`/api/bookings/${booking._id}/review`, {
        method: "POST",
        body: {
          overall,
          quality: Number(dims.quality || overall),
          communication: Number(dims.communication || overall),
          punctuality: Number(dims.punctuality || overall),
          professionalism: Number(dims.professionalism || overall),
          text: text.trim(),
        },
      });
      toast({ title: t("customer.review.submittedTitle"), description: t("customer.review.submittedDesc") });
      reload();
    } catch (e) {
      setErr(errText(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Star className="h-4 w-4 text-amber-500 dark:text-amber-400" />
        <h3 className="text-sm font-semibold">{t("customer.review.rateTitle")}</h3>
        <span className="text-xs text-muted-foreground">
          {t("customer.review.rateSubtitle", { name: rname(booking.workerId, t("customer.yourWorker")) })}
        </span>
      </div>

      <div className="mt-4 space-y-4">
        <div className="rounded-lg border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("customer.review.overallRating")} *
          </p>
          <div className="mt-1 flex items-center gap-3">
            <Stars value={overall} onChange={setOverall} size="h-7 w-7" />
            <span className="text-sm font-medium">
              {overall ? t("customer.review.of5", { n: overall }) : t("customer.review.selectRating")}
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {DIMENSIONS.map((d) => (
            <div key={d.key} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{t(d.labelKey)}</span>
              <Stars
                value={Number(dims[d.key] || overall)}
                onChange={(n) => setDims((prev) => ({ ...prev, [d.key]: n }))}
              />
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <Textarea
            rows={4}
            placeholder={t("customer.review.placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <FieldError msg={err} />
        </div>

        <Separator />

        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy}>
            {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("customer.review.submit")}
          </Button>
        </div>
      </div>
    </div>
  );
}
