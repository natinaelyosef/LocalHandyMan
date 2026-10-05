export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse space-y-4" aria-label="Loading">
      <div className="h-8 w-1/3 rounded-lg bg-muted" />
      <div className="h-40 rounded-xl border bg-card" />
      <div className="h-40 rounded-xl border bg-card" />
      <div className="h-40 rounded-xl border bg-card" />
    </div>
  );
}
