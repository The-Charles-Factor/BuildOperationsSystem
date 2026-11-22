import Link from "next/link";

export function PageHeader({
  title,
  // preferred
  subtitle,
  action,
  breadcrumb,
  // backward-compatible aliases
  eyebrow,
  description,
  actions,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  breadcrumb?: { label: string; href?: string }[];
  eyebrow?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  const subtext = subtitle ?? description;
  const trailing = action ?? actions;

  return (
    <header className="mb-5 min-w-0 sm:mb-7">
      {/* Eyebrow — small uppercase label above the title */}
      {eyebrow && (
        <div
          className="mb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] sm:mb-2"
          style={{ color: "var(--emerald-600)" }}
        >
          {eyebrow}
        </div>
      )}

      {/* Breadcrumb (my original API — kept) */}
      {!eyebrow && breadcrumb && breadcrumb.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-2.5 flex flex-wrap items-center gap-1.5 text-[12px] sm:mb-3"
          style={{ color: "var(--charcoal-400)" }}
        >
          {breadcrumb.map((b, i) => (
            <span key={`${b.label}-${i}`} className="flex min-w-0 items-center gap-1.5">
              {i > 0 && (
                <svg
                  width="9"
                  height="9"
                  viewBox="0 0 10 10"
                  fill="none"
                  className="shrink-0"
                >
                  <path
                    d="M3.5 2 6.5 5 3.5 8"
                    stroke="currentColor"
                    strokeWidth="1.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
              {b.href && i !== breadcrumb.length - 1 ? (
                <Link
                  href={b.href}
                  className="truncate transition hover:opacity-80"
                >
                  {b.label}
                </Link>
              ) : (
                <span
                  className="truncate"
                  style={{
                    color:
                      i === breadcrumb.length - 1
                        ? "var(--charcoal-700)"
                        : undefined,
                  }}
                >
                  {b.label}
                </span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0 flex-1">
          <h1
            className="break-words text-[20px] leading-[1.2] font-semibold tracking-[-0.015em] sm:text-[22px]"
            style={{ color: "var(--charcoal-900)" }}
          >
            {title}
          </h1>
          {subtext && (
            <p
              className="mt-1.5 max-w-2xl break-words text-[13px] leading-5"
              style={{ color: "var(--charcoal-500)" }}
            >
              {subtext}
            </p>
          )}
        </div>
        {trailing && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {trailing}
          </div>
        )}
      </div>
    </header>
  );
}