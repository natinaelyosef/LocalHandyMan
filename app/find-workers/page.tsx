"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search, ShieldCheck, Star, MapPin, Heart, Loader2, SlidersHorizontal, Zap, X } from "lucide-react";
import { SiteNav, SiteFooter } from "@/components/site/nav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { api, etb } from "@/lib/client";
import { useAuth } from "@/context/auth";
import { useLocale } from "@/context/locale";

type Worker = {
  _id: string;
  userId: string;
  name: string;
  avatarFileId?: string | null;
  profession: string;
  headline?: string;
  skills?: string[];
  yearsOfExperience: number;
  startingPrice: number;
  availability: string;
  emergencyAvailable: boolean;
  serviceArea: { city?: string; region?: string };
  rating: number;
  stats: { ratingSum: number; ratingCount: number; jobsCompleted: number };
  responseTimeMinutes: number;
  verified: boolean;
  favorite: boolean;
  featured?: boolean;
};

type Category = { _id: string; name: string; icon?: string; parent?: string | null };

function FindWorkers() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const { t } = useLocale();
  const [q, setQ] = useState(params.get("q") || "");
  const [city, setCity] = useState(params.get("city") || "");
  const [category, setCategory] = useState(params.get("category") || "");
  const [sort, setSort] = useState(params.get("sort") || "relevance");
  const [availability, setAvailability] = useState(params.get("availability") || "");
  const [emergency, setEmergency] = useState(params.get("emergency") === "1");
  const [verified, setVerified] = useState(params.get("verified") !== "0");
  const [minRating, setMinRating] = useState(params.get("rating") || "0");
  const [minPrice, setMinPrice] = useState(params.get("minPrice") || "");
  const [maxPrice, setMaxPrice] = useState(params.get("maxPrice") || "");
  const [page, setPage] = useState(Number(params.get("page") || 1));

  // Debounce free-text/numeric filters so typing doesn't fire a request per
  // keystroke. Selects/toggles (category, sort, availability, emergency,
  // verified, rating) apply instantly.
  const [qDeb, setQDeb] = useState(q);
  const [cityDeb, setCityDeb] = useState(city);
  const [minPriceDeb, setMinPriceDeb] = useState(minPrice);
  const [maxPriceDeb, setMaxPriceDeb] = useState(maxPrice);

  useEffect(() => {
    const h = setTimeout(() => setQDeb(q), 450);
    return () => clearTimeout(h);
  }, [q]);
  useEffect(() => {
    const h = setTimeout(() => setCityDeb(city), 450);
    return () => clearTimeout(h);
  }, [city]);
  useEffect(() => {
    const h = setTimeout(() => setMinPriceDeb(minPrice), 450);
    return () => clearTimeout(h);
  }, [minPrice]);
  useEffect(() => {
    const h = setTimeout(() => setMaxPriceDeb(maxPrice), 450);
    return () => clearTimeout(h);
  }, [maxPrice]);  const [items, setItems] = useState<Worker[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [favBusy, setFavBusy] = useState<string | null>(null);

  useEffect(() => {
    api<{ categories: Category[] }>("/api/categories").then((d) => setCategories(d.categories)).catch(() => {});
  }, []);

  useEffect(() => {
    const sp = new URLSearchParams();
    if (qDeb) sp.set("q", qDeb);
    if (cityDeb) sp.set("city", cityDeb);
    if (category) sp.set("category", category);
    if (sort) sp.set("sort", sort);
    if (availability) sp.set("availability", availability);
    if (emergency) sp.set("emergency", "1");
    if (!verified) sp.set("verified", "0");
    if (minRating && minRating !== "0") sp.set("rating", minRating);
    if (minPriceDeb) sp.set("minPrice", minPriceDeb);
    if (maxPriceDeb) sp.set("maxPrice", maxPriceDeb);
    sp.set("page", String(page));
    router.replace(`${pathname}?${sp.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDeb, cityDeb, category, sort, availability, emergency, verified, minRating, minPriceDeb, maxPriceDeb, page]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const sp = new URLSearchParams(params.toString());
    api<{ items: Worker[]; total: number; pages: number }>(`/api/workers?${sp.toString()}`)
      .then((d) => {
        if (!cancelled) {
          setItems(d.items);
          setTotal(d.total);
          setPages(d.pages);
        }
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [params]);

  const toggleFav = async (w: Worker) => {
    if (!user) return router.push("/login?next=/find-workers");
    setFavBusy(w.userId);
    try {
      const res = await api<{ favorite: boolean }>("/api/favorites", {
        body: { workerId: w.userId, remove: w.favorite },
      });
      setItems((prev) => prev.map((i) => (i.userId === w.userId ? { ...i, favorite: res.favorite } : i)));
    } catch {
      /* ignore */
    } finally {
      setFavBusy(null);
    }
  };

  const clearFilters = () => {
    setQ("");
    setCity("");
    setCategory("");
    setAvailability("");
    setEmergency(false);
    setVerified(true);
    setMinRating("0");
    setMinPrice("");
    setMaxPrice("");
    setPage(1);
  };

  const parents = categories.filter((c) => !c.parent);

  const availabilityLabel = (v: string) =>
    v === "available"
      ? t("public.availability.available")
      : v === "busy"
        ? t("public.availability.busy")
        : v === "away"
          ? t("public.availability.away")
          : v;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1 bg-muted/30">
        <div className="border-b bg-background">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
            <form
              className="flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setPage(1);
              }}
            >
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                    setPage(1);
                  }}
                  placeholder={t("public.find.searchPlaceholder")}
                  className="pl-9"
                />
              </div>
              <Input
                value={city}
                onChange={(e) => {
                  setCity(e.target.value);
                  setPage(1);
                }}
                placeholder={t("public.city")}
                className="sm:w-44"
              />
              <Select
                value={category || "all"}
                onValueChange={(v) => {
                  setCategory(v === "all" ? "" : v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="sm:w-52">
                  <SelectValue placeholder={t("common.category")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("public.find.allCategories")}</SelectItem>
                  {parents.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </form>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="h-9 w-40 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="relevance">{t("public.find.sort.relevance")}</SelectItem>
                  <SelectItem value="rating">{t("public.find.sort.rating")}</SelectItem>
                  <SelectItem value="price_asc">{t("public.find.sort.priceAsc")}</SelectItem>
                  <SelectItem value="price_desc">{t("public.find.sort.priceDesc")}</SelectItem>
                  <SelectItem value="experience">{t("public.find.sort.experience")}</SelectItem>
                  <SelectItem value="recent">{t("public.find.sort.recent")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={availability} onValueChange={(v) => { setAvailability(v === "any" ? "" : v); setPage(1); }}>
                <SelectTrigger className="h-9 w-36 text-xs">
                  <SelectValue placeholder={t("public.availability.label")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">{t("public.find.availability.any")}</SelectItem>
                  <SelectItem value="available">{t("public.find.availability.now")}</SelectItem>
                  <SelectItem value="busy">{t("public.availability.busy")}</SelectItem>
                  <SelectItem value="away">{t("public.availability.away")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={minRating} onValueChange={(v) => { setMinRating(v); setPage(1); }}>
                <SelectTrigger className="h-9 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">{t("public.find.rating.any")}</SelectItem>
                  <SelectItem value="4">{t("public.find.rating.r4")}</SelectItem>
                  <SelectItem value="4.5">{t("public.find.rating.r45")}</SelectItem>
                </SelectContent>
              </Select>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium">
                <Checkbox checked={emergency} onCheckedChange={(v) => { setEmergency(!!v); setPage(1); }} />
                <Zap className="h-3.5 w-3.5 text-red-500 dark:text-red-400" /> {t("common.urgency.emergency")}
              </label>
              <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-xs font-medium">
                <Checkbox checked={verified} onCheckedChange={(v) => { setVerified(!!v); setPage(1); }} />
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> {t("public.find.verifiedOnly")}
              </label>
              <Input
                value={minPrice}
                onChange={(e) => { setMinPrice(e.target.value); setPage(1); }}
                placeholder={t("public.find.minPrice")}
                className="h-9 w-24 text-xs"
                type="number"
              />
              <Input
                value={maxPrice}
                onChange={(e) => { setMaxPrice(e.target.value); setPage(1); }}
                placeholder={t("public.find.maxPrice")}
                className="h-9 w-24 text-xs"
                type="number"
              />
              <Button variant="ghost" size="sm" className="h-9 text-xs" onClick={clearFilters}>
                <X className="mr-1 h-3.5 w-3.5" /> {t("public.find.clear")}
              </Button>
              <span className="ml-auto text-xs text-muted-foreground">
                {loading ? t("public.find.searching") : total === 1 ? t("public.find.foundOne", { n: total }) : t("public.find.found", { n: total })}
              </span>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" /> {t("public.find.searchingWorkers")}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-dashed bg-background py-16 text-center">
              <SlidersHorizontal className="mx-auto h-8 w-8 text-muted-foreground" />
              <h3 className="mt-3 font-semibold">{t("public.find.emptyTitle")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t("public.find.emptyBody")}</p>
              <Button className="mt-4" variant="outline" onClick={clearFilters}>
                {t("common.clearFilters")}
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((w) => (
                <div key={w._id} className="group relative flex flex-col rounded-xl border bg-card p-5 transition hover:border-primary hover:shadow-md">
                  <button
                    onClick={() => toggleFav(w)}
                    className="absolute right-3 top-3 rounded-full p-1.5 hover:bg-muted"
                    aria-label={t("public.find.favorite")}
                    disabled={favBusy === w.userId}
                  >
                    <Heart
                      className={`h-4 w-4 transition ${
                        w.favorite ? "fill-red-500 text-red-500 dark:text-red-400" : "text-muted-foreground"
                      }`}
                    />
                  </button>
                  <Link href={`/workers/${w.userId}`} className="flex items-center gap-3">
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={w.avatarFileId ? `/api/uploads/${w.avatarFileId}` : ""} alt={w.name} />
                      <AvatarFallback>{w.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 font-semibold group-hover:text-primary">
                        <span className="truncate">{w.name}</span>
                        {w.verified && <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />}
                      </div>
                      <p className="truncate text-sm text-muted-foreground">{w.profession}</p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs">
                        <span className="flex items-center gap-0.5 font-medium">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {w.stats.ratingCount ? w.rating.toFixed(1) : t("public.rating.new")}
                        </span>
                        <span className="text-muted-foreground">· {t("public.jobs.count", { n: w.stats.jobsCompleted })}</span>
                      </div>
                    </div>
                  </Link>
                  <p className="mt-3 line-clamp-2 flex-1 text-sm text-muted-foreground">{w.headline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(w.skills || []).slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px] font-normal">
                        {s}
                      </Badge>
                    ))}
                    {(w.skills || []).length > 3 && (
                      <Badge variant="outline" className="text-[10px]">
                        +{w.skills!.length - 3}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-sm">
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5" /> {w.serviceArea?.city || "—"}
                    </span>
                    <span className="font-semibold text-primary">{etb(w.startingPrice)}</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Badge className={w.availability === "available" ? "bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300" : "bg-slate-100 dark:bg-slate-800/70 text-slate-600 dark:text-slate-400"}>
                      {availabilityLabel(w.availability)}
                    </Badge>
                    {w.emergencyAvailable && (
                      <Badge className="bg-red-100 dark:bg-red-950/70 text-red-700 dark:text-red-300">{t("common.urgency.emergency")}</Badge>
                    )}
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      {t("public.find.response", { n: w.responseTimeMinutes })}
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button size="sm" className="flex-1" asChild>
                      <Link href={`/workers/${w.userId}`}>{t("public.find.viewProfile")}</Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      asChild
                    >
                      <Link href={`/dashboard/customer/requests/new?worker=${w.userId}`}>{t("public.requestService")}</Link>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                {t("public.pagination.previous")}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("public.pagination.pageOf", { page, pages })}
              </span>
              <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                {t("common.next")}
              </Button>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

export default function FindWorkersPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-muted-foreground">{t("common.loading")}</div>}>
      <FindWorkers />
    </Suspense>
  );
}
