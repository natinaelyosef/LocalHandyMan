import Link from "next/link";
import SearchHero from "@/components/site/search-hero";
import { SiteNav, SiteFooter } from "@/components/site/nav";
import { Button } from "@/components/ui/button";
import { connectDB } from "@/lib/db";
import { getT } from "@/i18n/server";
import { unstable_cache as nextCache } from "next/cache";
import { ServiceCategory, WorkerProfile, Review } from "@/lib/models";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Star, ShieldCheck, MapPin, FileCheck2, Banknote, ArrowRight, Clock } from "lucide-react";

export const dynamic = "force-dynamic";

// The landing content changes rarely (new categories/workers a few times a
// day), so serve it from cache and hit MongoDB at most once every 5 minutes
// instead of on every single visit.
const getHomeData = nextCache(
  async () => {
    await connectDB();
    const [categories, workers, reviewCount] = await Promise.all([
      ServiceCategory.find({ active: true, parent: null }).sort({ order: 1 }).limit(16).lean(),
      WorkerProfile.find({ status: "approved" })
        .sort({ featured: -1, "stats.jobsCompleted": -1 })
        .limit(8)
        .populate("userId", "name avatarFileId")
        .lean(),
      Review.countDocuments({ status: "visible" }),
    ]);
    // Strip BSON types so the payload is cache-serializable.
    return JSON.parse(JSON.stringify({ categories, workers, reviewCount })) as {
      categories: { _id: string; name: string; description?: string; icon?: string }[];
      workers: {
        _id: string;
        profession: string;
        headline?: string;
        bio?: string;
        startingPrice: number;
        serviceArea?: { city?: string };
        stats?: { ratingSum: number; ratingCount: number; jobsCompleted: number };
        userId: { _id: string; name: string; avatarFileId?: string | null };
      }[];
      reviewCount: number;
    };
  },
  ["home-data"],
  { revalidate: 300 }
);

export default async function HomePage() {
  const t = await getT();
  const { categories, workers, reviewCount } = await getHomeData();

  const STEPS = [
    { n: 1, title: t("public.home.step1.title"), body: t("public.home.step1.body") },
    { n: 2, title: t("public.home.step2.title"), body: t("public.home.step2.body") },
    { n: 3, title: t("public.home.step3.title"), body: t("public.home.step3.body") },
    { n: 4, title: t("public.home.step4.title"), body: t("public.home.step4.body") },
    { n: 5, title: t("public.home.step5.title"), body: t("public.home.step5.body") },
    { n: 6, title: t("public.home.step6.title"), body: t("public.home.step6.body") },
    { n: 7, title: t("public.home.step7.title"), body: t("public.home.step7.body") },
    { n: 8, title: t("public.home.step8.title"), body: t("public.home.step8.body") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <section className="relative overflow-hidden bg-gradient-to-br from-primary via-primary to-cyan-700 text-white">
          <div className="absolute inset-0 bg-[url('/coverpage.png')] bg-cover bg-center opacity-15" />
          <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
            <div className="max-w-3xl">
              <Badge className="mb-4 bg-white/15 text-white hover:bg-white/20">{t("public.home.badge")}</Badge>
              <h1 className="text-3xl font-bold leading-tight sm:text-5xl md:text-6xl">
                {t("public.home.heroTitle")}
              </h1>
              <p className="mt-4 max-w-2xl text-white/90 sm:text-lg">
                {t("public.home.heroSub")}
              </p>
              <SearchHero />
              <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/80">
                <span className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> {t("public.home.pillVerified")}</span>
                <span className="flex items-center gap-1.5"><Banknote className="h-4 w-4" /> {t("public.home.pillNoPayments")}</span>
                <span className="flex items-center gap-1.5"><FileCheck2 className="h-4 w-4" /> {t("public.home.pillManualVerify")}</span>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-2xl font-bold sm:text-3xl">{t("public.home.browseTitle")}</h2>
              <p className="mt-1 text-muted-foreground">{t("public.home.browseSub")}</p>
            </div>
            <Link href="/services" className="hidden items-center text-sm font-medium text-primary hover:underline sm:flex">
              {t("public.home.allServices")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {categories.map((c) => (
              <Link
                key={String(c._id)}
                href={`/find-workers?category=${String(c._id)}`}
                className="group rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
              >
                <div className="text-3xl">{c.icon}</div>
                <div className="mt-3 font-semibold group-hover:text-primary">{c.name}</div>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{c.description}</p>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-muted/40 py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8">
              <h2 className="text-2xl font-bold sm:text-3xl">{t("public.home.featuredTitle")}</h2>
              <p className="mt-1 text-muted-foreground">
                {t("public.home.featuredSub", { workers: workers.length, reviews: reviewCount })}
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {workers.map((w) => {
                const u = w.userId as unknown as { _id: unknown; name: string; avatarFileId?: string | null };
                const stats = w.stats || { ratingSum: 0, ratingCount: 0, jobsCompleted: 0 };
                const rating = stats.ratingCount ? (stats.ratingSum / stats.ratingCount).toFixed(1) : t("public.rating.new");
                return (
                  <Link
                    key={String(w._id)}
                    href={`/workers/${String(u._id)}`}
                    className="group rounded-xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={u.avatarFileId ? `/api/uploads/${u.avatarFileId}` : ""} alt={u.name} />
                        <AvatarFallback>{u.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1 font-semibold group-hover:text-primary">
                          <span className="truncate">{u.name}</span>
                          <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{w.profession}</p>
                      </div>
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{w.headline || w.bio}</p>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 font-medium">
                        <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {rating}
                        <span className="font-normal text-muted-foreground">({stats.ratingCount})</span>
                      </span>
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" /> {(w.serviceArea as { city?: string })?.city || "—"}
                      </span>
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("public.jobs.count", { n: stats.jobsCompleted })}</span>
                      <span className="font-medium text-primary">{t("public.home.fromPrice", { price: Number(w.startingPrice).toLocaleString() })}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
            <div className="mt-6 text-center">
              <Link href="/find-workers" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
                {t("public.home.browseAllWorkers")} <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="mb-8 text-center">
            <h2 className="text-2xl font-bold sm:text-3xl">{t("nav.howItWorks")}</h2>
            <p className="mt-1 text-muted-foreground">{t("public.home.howSub")}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-xl border bg-card p-5">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                  {s.n}
                </div>
                <h3 className="mt-3 font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 text-center">
            <Link href="/how-it-works" className="inline-flex items-center text-sm font-medium text-primary hover:underline">
              {t("public.home.seeGuide")} <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="bg-muted/40 py-14">
          <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3">
            <div className="rounded-xl border bg-card p-6">
              <ShieldCheck className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              <h3 className="mt-3 font-semibold">{t("public.home.trust1.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("public.home.trust1.body")}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <Banknote className="h-8 w-8 text-primary" />
              <h3 className="mt-3 font-semibold">{t("public.home.trust2.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("public.home.trust2.body")}
              </p>
            </div>
            <div className="rounded-xl border bg-card p-6">
              <Clock className="h-8 w-8 text-cyan-600 dark:text-cyan-400" />
              <h3 className="mt-3 font-semibold">{t("public.home.trust3.title")}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("public.home.trust3.body")}
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl px-4 py-14 text-center sm:px-6">
          <h2 className="text-2xl font-bold sm:text-3xl">{t("public.home.ctaTitle")}</h2>
          <p className="mx-auto mt-2 max-w-xl text-muted-foreground">
            {t("public.home.ctaSub")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/register">
              <Button size="lg">{t("public.home.createFreeAccount")}</Button>
            </Link>
            <Link href="/register?role=worker">
              <Button size="lg" variant="outline">{t("public.home.workWithUs")}</Button>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
