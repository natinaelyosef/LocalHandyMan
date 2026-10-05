export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse px-4 py-14 sm:px-6" aria-label="Loading">
      <div className="h-10 w-2/3 rounded-lg bg-muted" />
      <div className="mt-3 h-5 w-1/2 rounded bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl border bg-card p-5">
            <div className="h-8 w-8 rounded-full bg-muted" />
            <div className="mt-3 h-4 w-3/4 rounded bg-muted" />
            <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
