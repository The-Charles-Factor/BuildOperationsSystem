export function EmptyState({
  icon,
  title = "Nothing here yet",
  hint,
  description,
  action,
}: {
  icon?: React.ReactNode;
  title?: string;
  hint?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  const subtext = hint ?? description;

  return (
    <div className="flex w-full min-w-0 flex-col items-center justify-center px-4 py-10 text-center sm:px-6 sm:py-16">
      <div
        className="mb-4 grid h-12 w-12 shrink-0 place-items-center rounded-full"
        style={{
          background: "var(--emerald-50)",
          border: "1px solid var(--emerald-100)",
          color: "var(--emerald-600)",
        }}
      >
        {icon ?? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M3 5.5 10 2l7 3.5v9L10 18l-7-3.5v-9Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M3 5.5 10 9l7-3.5M10 9v9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>

      <div
        className="w-full min-w-0 break-words text-[14px] font-semibold tracking-[-0.01em]"
        style={{ color: "var(--charcoal-900)" }}
      >
        {title}
      </div>

      {subtext && (
        <p
          className="mt-1.5 w-full min-w-0 max-w-sm break-words text-[12.5px] leading-5"
          style={{ color: "var(--charcoal-500)" }}
        >
          {subtext}
        </p>
      )}

      {action && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
}