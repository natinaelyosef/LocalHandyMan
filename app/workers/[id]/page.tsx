import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteNav, SiteFooter } from "@/components/site/nav";
import { connectDB } from "@/lib/db";
import { WorkerProfile, User, Review, Booking } from "@/lib/models";
import { AvailabilityMonth } from "@/components/dashboard/availability-calendar";
import { buildAvailability } from "@/lib/services/availability";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ShieldCheck, MapPin, Clock, Languages, CalendarDays, Briefcase, FileImage } from "lucide-react";
import { etb, fmtDate } from "@/lib/client";
import { getT } from "@/i18n/server";
import { MessageWorkerButton } from "@/components/site/message-worker-button";

export const dynamic = "force-dynamic";

export default async function WorkerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const t = await getT();
  const { id } = await params;
  await connectDB();
  const [profile, user] = await Promise.all([
    WorkerProfile.findOne({ userId: id }).lean(),
    User.findById(id).select("name avatarFileId createdAt").lean(),
  ]);
  if (!profile || !user) notFound();

  const availabilityLabel = (v: string) =>
    v === "available"
      ? t("public.availability.available")
      : v === "busy"
        ? t("public.availability.busy")
        : v === "away"
          ? t("public.availability.away")
          : v;

  // Per-day availability window (shared by the query and the calendar below).
  const _today = new Date();
  const dayStart = new Date(_today.getFullYear(), _today.getMonth(), _today.getDate());
  const HORIZON_DAYS = 30;

  const [reviews, upcoming] = await Promise.all([
    Review.find({ workerId: id, status: "visible" })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate("customerId", "name avatarFileId")
      .lean(),
    Booking.find({
      workerId: id,
      startDate: { $gte: dayStart, $lte: new Date(dayStart.getTime() + HORIZON_DAYS * 86400000) },
    })
      .select("_id startDate status")
      .lean(),
  ]);

  const stats = profile.stats || { ratingSum: 0, ratingCount: 0, jobsCompleted: 0, jobsCancelled: 0 };
  const rating = stats.ratingCount ? Math.round((stats.ratingSum / stats.ratingCount) * 10) / 10 : 0;
  const portfolio = (profile.portfolio || []).filter((p) => p.status === "published");

  // Per-day availability so a customer can pick a date before requesting.
  const availabilityDays = buildAvailability({
    from: dayStart,
    days: HORIZON_DAYS,
    schedule: profile.schedule,
    timeOff: profile.timeOff as never,
    bookings: upcoming as never,
    availability: profile.availability,
    capacity: 1,
  });
  const openDays = availabilityDays.filter((d) => d.available).length;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1 bg-muted/30">
        <div className="border-b bg-background">
          <div className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:px-6">
            <Avatar className="h-24 w-24">
              <AvatarImage src={user.avatarFileId ? `/api/uploads/${user.avatarFileId}` : ""} alt={user.name} />
              <AvatarFallback className="text-2xl">{user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{user.name}</h1>
                {profile.status === "approved" && (
                  <Badge className="bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300">
                    <ShieldCheck className="mr-1 h-3.5 w-3.5" /> {t("public.profile.verifiedWorker")}
                  </Badge>
                )}
                <Badge variant="outline">{profile.profession}</Badge>
              </div>
              <p className="mt-1 text-muted-foreground">{profile.headline}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Star className="h-4 w-4 fill-amber-400 text-amber-400" /> {rating || "—"}{" "}
                  <span>({t("public.profile.reviewsCount", { n: stats.ratingCount })})</span>
                </span>
                <span className="flex items-center gap-1"><Briefcase className="h-4 w-4" /> {t("public.profile.jobsDone", { n: stats.jobsCompleted })}</span>
                <span className="flex items-center gap-1"><MapPin className="h-4 w-4" /> {profile.serviceArea?.city || "—"} ({t("public.profile.radiusKm", { n: profile.serviceArea?.radiusKm || 15 })})</span>
                <span className="flex items-center gap-1"><Clock className="h-4 w-4" /> {t("public.profile.responds", { n: profile.responseTimeMinutes })}</span>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-2">
              <div className="rounded-lg border bg-card px-5 py-3 text-center">
                <p className="text-xs text-muted-foreground">{t("public.profile.startingFrom")}</p>
                <p className="text-xl font-bold text-primary">{etb(profile.startingPrice)}</p>
              </div>
              <div className="flex gap-2">
                <MessageWorkerButton workerId={id} />
                <Button asChild>
                  <Link href={`/dashboard/customer/requests/new?worker=${id}`}>{t("public.requestService")}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader><CardTitle>{t("public.profile.about")}</CardTitle></CardHeader>
              <CardContent>
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {profile.bio || t("public.profile.noBio")}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(profile.skills || []).map((s) => (
                    <Badge key={s} variant="secondary">{s}</Badge>
                  ))}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div><p className="text-xs text-muted-foreground">{t("public.profile.experience")}</p><p className="font-medium">{t("public.profile.years", { n: profile.yearsOfExperience })}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("public.profile.languages")}</p><p className="font-medium">{(profile.languages || []).join(", ")}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("public.availability.label")}</p><p className="font-medium capitalize">{availabilityLabel(profile.availability)}</p></div>
                  <div><p className="text-xs text-muted-foreground">{t("common.urgency.emergency")}</p><p className="font-medium">{profile.emergencyAvailable ? t("public.availability.available") : t("common.no")}</p></div>
                </div>
              </CardContent>
            </Card>

            {portfolio.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><FileImage className="h-5 w-5" /> {t("nav.portfolio")}</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  {portfolio.map((p) => (
                    <div key={String(p._id)} className="rounded-lg border p-4">
                      <p className="font-semibold">{p.title}</p>
                      <p className="text-xs text-muted-foreground">{p.category}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.description}</p>
                      <div className="mt-3 flex gap-2">
                        {(["beforeFileId", "duringFileId", "afterFileId"] as const).map((k) =>
                          p[k] ? (
                            <a key={k} href={`/api/uploads/${p[k]}`} target="_blank" rel="noreferrer" className="text-xs font-medium text-primary hover:underline capitalize">
                              {k === "beforeFileId" ? t("public.profile.before") : k === "duringFileId" ? t("public.profile.during") : t("public.profile.after")}
                            </a>
                          ) : null
                        )}
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {p.area} · {fmtDate(p.completedAt)}
                      </p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>{t("public.profile.reviewsTitle", { n: reviews.length })}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {reviews.length === 0 && <p className="text-sm text-muted-foreground">{t("public.profile.noReviews")}</p>}
                {reviews.map((r) => {
                  const c = r.customerId as unknown as { name: string; avatarFileId?: string | null };
                  return (
                    <div key={String(r._id)} className="rounded-lg border p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={c.avatarFileId ? `/api/uploads/${c.avatarFileId}` : ""} />
                            <AvatarFallback>{c.name?.slice(0, 2).toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <span className="text-sm font-medium">{c.name}</span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((i) => (
                            <Star key={i} className={`h-4 w-4 ${i <= r.overall ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
                          ))}
                        </div>
                      </div>
                      <p className="mt-2 text-sm text-muted-foreground">{r.text}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{fmtDate(r.createdAt)}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-base">{t("public.profile.workingHours")}</CardTitle></CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                {(profile.schedule || []).length === 0 && <p className="text-muted-foreground">{t("common.notSet")}</p>}
                {(profile.schedule || []).map((s) => (
                  <div key={s.day} className="flex justify-between">
                    <span className="uppercase">{s.day}</span>
                    <span className={s.closed ? "text-muted-foreground" : "font-medium"}>
                      {s.closed ? t("public.profile.closed") : `${s.open} – ${s.close}`}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("common.schedulePickDate")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  {t("common.scheduleAvailableOn", { n: openDays, total: availabilityDays.length })}
                </p>
                <AvailabilityMonth days={availabilityDays} interactive={false} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">{t("public.profile.serviceArea")}</CardTitle></CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <p className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" /> {profile.serviceArea?.region}, {profile.serviceArea?.city}
                  {profile.serviceArea?.woreda ? ` · ${t("public.profile.woreda", { woreda: profile.serviceArea.woreda })}` : ""}
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" /> {t("public.profile.servesWithin", { km: profile.serviceArea?.radiusKm || 15 })}
                </p>
                <p className="mt-2 flex items-center gap-2">
                  <Languages className="h-4 w-4" /> {(profile.languages || []).join(", ")}
                </p>
              </CardContent>
            </Card>

            <Card className="border-primary/40 bg-primary/5">
              <CardContent className="pt-6 text-sm">
                <p className="font-semibold">{t("public.profile.paymentWorks")}</p>
                <p className="mt-1 text-muted-foreground">
                  {t("public.profile.paymentWorksBody")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
