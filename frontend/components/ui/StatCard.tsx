type Tone = "default" | "warning" | "danger" | "success";

export function StatCard({
  // preferred
  label,
  value,
  delta,
  deltaLabel,
  hint,
  tone = "default",
  // backward-compatible aliases + new visual hooks
  title,
  description,
  icon,
  accent,
}: {
  label?: string;
  value: string | number;
  delta?: number;
  deltaLabel?: string;
  hint?: string;
  tone?: Tone;
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  /** Accent color override — defaults to emerald */
  accent?: string;
}) {
  const heading = label ?? title ?? "";
  const subtext = hint ?? description;
  const hasDelta = delta !== undefined;
  const isUp = (delta ?? 0) >= 0;
  const accentColor = accent ?? "var(--emerald-500)";

  const toneColor =
    tone === "warning"
      ? "var(--warning)"
      : tone === "danger"
        ? "var(--danger)"
        : tone === "success"
          ? "var(--emerald-600)"
          : "var(--charcoal-400)";

  return (
    <div
      className="bo-transition group relative min-w-0 overflow-hidden rounded-[var(--radius-lg)] p-3.5 sm:p-4"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Top hairline accent — faint by default, illuminates on hover */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px opacity-40 transition-opacity group-hover:opacity-100"
        style={{
          background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
        }}
      />

      <div className="flex min-w-0 items-start justify-between gap-2.5 sm:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Optional leading icon */}
          {icon && (
            <span
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md"
              style={{
                background: "var(--emerald-50)",
                color: accentColor,
              }}
            >
              {icon}
            </span>
          )}

          <span
            className="min-w-0 truncate text-[11px] font-medium uppercase tracking-[0.06em]"
            style={{ color: "var(--charcoal-400)" }}
          >
            {heading}
          </span>
        </div>

        {hasDelta && (
          <span
            className="inline-flex shrink-0 items-center gap-0.5 text-[11.5px] font-medium tabular-nums"
            style={{ color: isUp ? "var(--emerald-600)" : "var(--danger)" }}
          >
            <svg
              width="9"
              height="9"
              viewBox="0 0 10 10"
              fill="none"
              className="shrink-0"
            >
              <path
                d={
                  isUp
                    ? "M5 8V2M2.5 4.5 5 2l2.5 2.5"
                    : "M5 2v6M2.5 5.5 5 8l2.5-2.5"
                }
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {Math.abs(delta)}%
          </span>
        )}
      </div>

      <div
        className="mt-2.5 min-w-0 break-words text-[20px] leading-tight font-semibold tabular-nums tracking-[-0.02em] sm:text-[24px] sm:leading-none"
        style={{ color: "var(--charcoal-900)" }}
      >
        {value}
      </div>

      {(subtext || deltaLabel) && (
        <div className="mt-2 flex min-w-0 items-center gap-2 text-[11.5px] leading-4">
          {subtext && (
            <span className="min-w-0 break-words" style={{ color: toneColor }}>
              {subtext}
            </span>
          )}
          {deltaLabel && !subtext && (
            <span
              className="min-w-0 break-words"
              style={{ color: "var(--charcoal-400)" }}
            >
              {deltaLabel}
            </span>
          )}
        </div>
      )}
    </div>
  );
}