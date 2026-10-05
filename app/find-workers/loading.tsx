import { SiteNav } from "@/components/site/nav";

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col" aria-label="Loading">
      <SiteNav />
      <main className="flex-1 bg-muted/30">
        <div className="mx-auto max-w-7xl animate-pulse px-4 py-6 sm:px-6">
          <div className="h-12 rounded-xl bg-muted" />
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl border bg-card p-5">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 rounded bg-muted" />
                    <div className="h-3 w-1/3 rounded bg-muted" />
                  </div>
                </div>
                <div className="mt-4 h-3 w-full rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
