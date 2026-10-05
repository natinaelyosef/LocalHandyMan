export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse px-4 py-8" aria-label="Loading">
      <div className="flex items-center gap-4">
        <div className="h-20 w-20 rounded-full bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-5 w-1/3 rounded bg-muted" />
          <div className="h-4 w-1/4 rounded bg-muted" />
        </div>
      </div>
      <div className="mt-6 h-48 rounded-xl border bg-card" />
    </div>
  );
}
