import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/site/nav";
import { Button } from "@/components/ui/button";
import { getT } from "@/i18n/server";
import { CheckCircle2, Banknote, Upload, ShieldCheck, Wrench, Star } from "lucide-react";

export default async function HowItWorksPage() {
  const t = await getT();

  const FLOW = [
    { icon: ShieldCheck, title: t("public.hiw.step1.title"), body: t("public.hiw.step1.body") },
    { icon: Wrench, title: t("public.hiw.step2.title"), body: t("public.hiw.step2.body") },
    { icon: CheckCircle2, title: t("public.hiw.step3.title"), body: t("public.hiw.step3.body") },
    { icon: CheckCircle2, title: t("public.hiw.step4.title"), body: t("public.hiw.step4.body") },
    { icon: CheckCircle2, title: t("public.hiw.step5.title"), body: t("public.hiw.step5.body") },
    { icon: Banknote, title: t("public.hiw.step6.title"), body: t("public.hiw.step6.body") },
    { icon: Upload, title: t("public.hiw.step7.title"), body: t("public.hiw.step7.body") },
    { icon: ShieldCheck, title: t("public.hiw.step8.title"), body: t("public.hiw.step8.body") },
    { icon: Wrench, title: t("public.hiw.step9.title"), body: t("public.hiw.step9.body") },
    { icon: Star, title: t("public.hiw.step10.title"), body: t("public.hiw.step10.body") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <div className="border-b bg-muted/40">
          <div className="mx-auto max-w-3xl px-4 py-12 text-center sm:px-6">
            <h1 className="text-3xl font-bold sm:text-4xl">{t("public.hiw.title")}</h1>
            <p className="mt-3 text-muted-foreground">
              {t("public.hiw.sub")}
            </p>
          </div>
        </div>

        <div className="mx-auto max-w-3xl space-y-4 px-4 py-10 sm:px-6">
          {FLOW.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="flex gap-4 rounded-xl border bg-card p-5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="font-semibold">{s.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
                </div>
              </div>
            );
          })}

          <div id="quotations" className="rounded-xl border border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/60 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-amber-900 dark:text-amber-200">
              <Banknote className="h-5 w-5" /> {t("public.hiw.moneyTitle")}
            </h2>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-900/90 dark:text-amber-200/90">
              <li>{t("public.hiw.money1a")} <strong>{t("public.hiw.money1b")}</strong></li>
              <li>{t("public.hiw.money2")}</li>
              <li>{t("public.hiw.money3")}</li>
              <li>{t("public.hiw.money4")}</li>
              <li>{t("public.hiw.money5a")} <strong>{t("public.hiw.money5b")}</strong></li>
            </ul>
          </div>

          <div className="flex flex-wrap justify-center gap-3 pt-4">
            <Link href="/register"><Button size="lg">{t("common.getStarted")}</Button></Link>
            <Link href="/find-workers"><Button size="lg" variant="outline">{t("public.hiw.browseWorkers")}</Button></Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
