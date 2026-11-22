export function ErrorState({
  title = "Something went wrong",
  message,
  action,
}: {
  title?: string;
  message: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      role="alert"
      className="flex min-w-0 flex-col gap-3 rounded-[var(--radius-lg)] px-4 py-3.5 sm:flex-row sm:items-start sm:px-5 sm:py-4"
      style={{
        background: "var(--danger-bg)",
        border: "1px solid var(--danger-border)",
      }}
    >
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <div
          className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full"
          style={{ background: "var(--danger)", color: "white" }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path
              d="M5.5 3v3.5M5.5 8.5v.01"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <div
            className="break-words text-[13px] font-semibold"
            style={{ color: "var(--danger)" }}
          >
            {title}
          </div>
          <div
            className="mt-0.5 break-words text-[12.5px] leading-5"
            style={{ color: "var(--charcoal-700)" }}
          >
            {message}
          </div>
        </div>
      </div>

      {action && (
        <div className="flex shrink-0 flex-wrap items-center gap-2 pl-8 sm:pl-0">
          {action}
        </div>
      )}
    </div>
  );
}