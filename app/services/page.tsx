import Link from "next/link";
import { SiteNav, SiteFooter } from "@/components/site/nav";
import { connectDB } from "@/lib/db";
import { getT } from "@/i18n/server";
import { ServiceCategory, WorkerProfile } from "@/lib/models";

export const dynamic = "force-dynamic";

export default async function ServicesPage() {
  const t = await getT();
  await connectDB();
  const parents = await ServiceCategory.find({ active: true, parent: null }).sort({ order: 1 }).lean();
  const children = await ServiceCategory.find({ active: true, parent: { $ne: null } }).sort({ order: 1 }).lean();
  const counts = await WorkerProfile.aggregate([
    { $match: { status: "approved" } },
    { $unwind: "$categoryIds" },
    { $group: { _id: "$categoryIds", n: { $sum: 1 } } },
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteNav />
      <main className="flex-1">
        <div className="border-b bg-muted/40">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
            <h1 className="text-3xl font-bold">{t("public.services.title")}</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {t("public.services.sub")}
            </p>
          </div>
        </div>
        <div className="mx-auto max-w-7xl space-y-10 px-4 py-10 sm:px-6">
          {parents.map((p) => {
            const subs = children.filter((c) => String(c.parent) === String(p._id));
            const n = countMap[String(p._id)] || 0;
            return (
              <section key={String(p._id)} id={String(p.slug)}>
                <div className="mb-4 flex items-center gap-3">
                  <span className="text-3xl">{p.icon}</span>
                  <div>
                    <h2 className="text-xl font-bold">{p.name}</h2>
                    <p className="text-sm text-muted-foreground">{p.description}</p>
                  </div>
                  <Link
                    href={`/find-workers?category=${String(p._id)}`}
                    className="ml-auto hidden shrink-0 text-sm font-medium text-primary hover:underline sm:block"
                  >
                    {t("public.services.workerCount", { n })}
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {subs.map((s) => (
                    <Link
                      key={String(s._id)}
                      href={`/find-workers?category=${String(s.parent)}&q=${encodeURIComponent(String(s.name))}`}
                      className="rounded-lg border bg-card px-4 py-3 text-sm font-medium transition hover:border-primary hover:text-primary"
                    >
                      {s.name}
                    </Link>
                  ))}
                  <Link
                    href={`/find-workers?category=${String(p._id)}`}
                    className="rounded-lg border border-dashed bg-muted/40 px-4 py-3 text-sm font-medium text-primary transition hover:border-primary"
                  >
                    {t("public.services.allWorkers", { category: p.name.toLowerCase() })}
                  </Link>
                </div>
              </section>
            );
          })}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
