"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Heart, MapPin, Users } from "lucide-react";
import { DashboardShell } from "@/components/dashboard/shell";
import { CUSTOMER_NAV } from "@/components/dashboard/nav-config";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api, etb, fileUrl } from "@/lib/client";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/context/locale";
import type { FavoriteWorker } from "@/app/dashboard/customer/_lib/types";
import { ratingOf, rid, rname } from "@/app/dashboard/customer/_lib/types";
import { CardsSkeleton, EmptyState, ErrorState, Stars, errText } from "@/app/dashboard/customer/_lib/ui";

export default function FavoritesPage() {
  const { toast } = useToast();
  const { t } = useLocale();
  const [workers, setWorkers] = useState<FavoriteWorker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const d = await api<{ workers: FavoriteWorker[] }>("/api/favorites");
      setWorkers(d.workers || []);
    } catch (e) {
      setError(errText(e, t));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  const remove = async (w: FavoriteWorker) => {
    const userId = rid(w.userId);
    setBusy(userId);
    try {
      await api("/api/favorites", { body: { workerId: userId, remove: true } });
      setWorkers((prev) => prev.filter((x) => rid(x.userId) !== userId));
      toast({
        title: t("customer.favorites.removedTitle"),
        description: t("customer.favorites.removedDesc", { name: rname(w.userId, t("customer.workerLabel")) }),
      });
    } catch (e) {
      toast({ title: t("customer.favorites.updateFailed"), description: errText(e, t), variant: "destructive" });
    } finally {
      setBusy("");
    }
  };

  return (
    <DashboardShell role="customer" nav={CUSTOMER_NAV} title={t("nav.favorites")} subtitle={t("customer.favorites.subtitle")}>
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {workers.length === 1
              ? t("customer.favorites.savedOne")
              : t("customer.favorites.savedMany", { n: workers.length })}
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/find-workers">
              {t("customer.favorites.browseWorkers")} <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {loading && <CardsSkeleton n={3} />}
        {!loading && error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && workers.length === 0 && (
          <EmptyState icon={Heart} title={t("customer.favorites.emptyTitle")} message={t("customer.favorites.emptyMsg")}>
            <Button asChild>
              <Link href="/find-workers">
                <Users className="mr-2 h-4 w-4" /> {t("customer.favorites.browseWorkers")}
              </Link>
            </Button>
          </EmptyState>
        )}

        {!loading && !error && workers.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {workers.map((w) => {
              const userId = rid(w.userId);
              const rating = ratingOf(w.stats);
              return (
                <div key={w._id} className="flex flex-col rounded-xl border bg-card p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={w.userId && typeof w.userId === "object" && w.userId.avatarFileId ? fileUrl(w.userId.avatarFileId) : ""} alt={rname(w.userId)} />
                      <AvatarFallback>{(rname(w.userId) || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <Link href={`/workers/${userId}`} className="truncate font-semibold hover:underline">
                        {rname(w.userId, t("customer.workerLabel"))}
                      </Link>
                      <p className="truncate text-sm text-muted-foreground">{w.profession}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <Stars value={rating} />
                        <span className="text-xs text-muted-foreground">
                          {rating ? rating.toFixed(1) : t("customer.favorites.noRatings")}
                          {w.stats?.ratingCount ? ` (${w.stats.ratingCount})` : ""}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      aria-label={t("customer.favorites.removeLabel")}
                      disabled={busy === userId}
                      onClick={() => remove(w)}
                      className="rounded-full p-2 text-red-500 dark:text-red-400 transition hover:bg-red-50 dark:hover:bg-red-950/60 disabled:opacity-50"
                    >
                      <Heart className="h-5 w-5" fill="currentColor" />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {w.serviceArea?.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" /> {w.serviceArea.city}
                      </span>
                    )}
                    {w.startingPrice ? (
                      <span>{t("customer.favorites.from", { amount: etb(w.startingPrice) })}</span>
                    ) : null}
                    <span>{t("customer.favorites.jobsDone", { n: w.stats?.jobsCompleted || 0 })}</span>
                  </div>

                  <div className="mt-4 flex gap-2 border-t pt-3">
                    <Button asChild size="sm" variant="outline" className="flex-1">
                      <Link href={`/workers/${userId}`}>
                        {t("customer.viewProfile")} <ArrowRight className="ml-2 h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="sm">
                      <Link href={`/dashboard/customer/requests/new?worker=${userId}`}>
                        {t("customer.favorites.requestQuote")}
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}
