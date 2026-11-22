import { ChevronLeft, ChevronRight } from "lucide-react";

export const DEFAULT_PAGE_SIZE = 10;

interface PaginationProps {
  page: number;
  totalPages?: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize = DEFAULT_PAGE_SIZE,
}: PaginationProps) {
  const resolvedPageSize = pageSize > 0 ? pageSize : DEFAULT_PAGE_SIZE;

  const computedTotalPages =
    totalItems !== undefined
      ? Math.max(1, Math.ceil(totalItems / resolvedPageSize))
      : Math.max(1, totalPages ?? 1);

  const safePage = Math.min(Math.max(1, page), computedTotalPages);

  if (computedTotalPages <= 1 && (!totalItems || totalItems <= resolvedPageSize)) {
    return null;
  }

  const start =
    totalItems !== undefined && totalItems > 0
      ? (safePage - 1) * resolvedPageSize + 1
      : undefined;
  const end =
    totalItems !== undefined && totalItems > 0
      ? Math.min(safePage * resolvedPageSize, totalItems)
      : undefined;

  return (
    <div className="flex w-full min-w-0 flex-col gap-3 border-t border-[#e7ece8] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="min-w-0 break-words text-xs text-[#718078]">
        {start !== undefined && end !== undefined && totalItems !== undefined
          ? `Showing ${start}–${end} of ${totalItems}`
          : `Page ${safePage} of ${computedTotalPages}`}
      </p>

      <div className="flex items-center justify-between gap-1.5 sm:justify-start">
        <button
          type="button"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-[#dce5de] bg-white text-[#526057] transition hover:bg-[#f3f7f4] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-h-0 sm:w-8 sm:min-w-0"
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="min-w-20 text-center text-xs font-semibold text-[#526057]">
          {safePage} / {computedTotalPages}
        </span>

        <button
          type="button"
          disabled={safePage >= computedTotalPages}
          onClick={() => onPageChange(Math.min(computedTotalPages, safePage + 1))}
          className="flex min-h-10 min-w-10 shrink-0 items-center justify-center rounded-lg border border-[#dce5de] bg-white text-[#526057] transition hover:bg-[#f3f7f4] disabled:cursor-not-allowed disabled:opacity-40 sm:h-8 sm:min-h-0 sm:w-8 sm:min-w-0"
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}