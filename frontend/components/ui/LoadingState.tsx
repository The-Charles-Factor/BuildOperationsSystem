export function LoadingState({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="w-full min-w-0 space-y-2.5 sm:space-y-3"
      aria-busy="true"
      aria-live="polite"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="min-w-0 rounded-[var(--radius)] p-3.5 sm:p-4"
          style={{
            background: "var(--surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            className="h-3 max-w-full animate-pulse rounded"
            style={{
              background: "var(--border-soft)",
              width: `${55 + ((i * 17) % 35)}%`,
            }}
          />
          <div
            className="mt-3 h-2.5 max-w-full animate-pulse rounded"
            style={{
              background: "var(--border-soft)",
              width: `${30 + ((i * 11) % 25)}%`,
            }}
          />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}