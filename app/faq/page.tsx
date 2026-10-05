import { SiteNav, SiteFooter } from "@/components/site/nav";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { getT } from "@/i18n/server";

export default async function FaqPage() {
  const t = await getT();

  const FAQS = [
    { q: t("public.faq.q1"), a: t("public.faq.a1") },
    { q: t("public.faq.q2"), a: t("public.faq.a2") },
    { q: t("public.faq.q3"), a: t("public.faq.a3") },
    { q: t("public.faq.q4"), a: t("public.faq.a4") },
    { q: t("public.faq.q5"), a: t("public.faq.a5") },
    { q: t("public.faq.q6"), a: t("public.faq.a6") },
    { q: t("public.faq.q7"), a: t("public.faq.a7") },
    { q: t("public.faq.q8"), a: t("public.faq.a8") },
    { q: t("public.faq.q9"), a: t("public.faq.a9") },
    { q: t("public.faq.q10"), a: t("public.faq.a10") },
    { q: t("public.faq.q11"), a: t("public.faq.a11") },
    { q: t("public.faq.q12"), a: t("public.faq.a12") },
    { q: t("public.faq.q13"), a: t("public.faq.a13") },
    { q: t("public.faq.q14"), a: t("public.faq.a14") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <div className="border-b bg-muted/40">
          <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
            <h1 className="text-3xl font-bold">{t("public.faq.title")}</h1>
            <p className="mt-2 text-muted-foreground">
              {t("public.faq.sub")}
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6" id="payments">
          <Accordion type="single" collapsible className="w-full">
            {FAQS.map((f, i) => (
              <AccordionItem key={i} value={`item-${i}`}>
                <AccordionTrigger className="text-left">{f.q}</AccordionTrigger>
                <AccordionContent className="text-muted-foreground">{f.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
