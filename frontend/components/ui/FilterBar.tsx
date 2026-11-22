import * as React from "react";
import { Filter, RotateCcw } from "lucide-react";
import { Button } from "./Button";

interface FilterBarProps {
  children?: React.ReactNode;
  onReset?: () => void;
  activeCount?: number;
  className?: string;
}

export function FilterBar({
  children,
  onReset,
  activeCount = 0,
  className = "",
}: FilterBarProps) {
  return (
    <div
      className={[
        "flex min-w-0 flex-col gap-3 rounded-2xl border border-[#e1e8e2] bg-white p-3 sm:flex-row sm:items-center",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-[#526057]">
        <Filter className="h-4 w-4 shrink-0 text-[#15803d]" />
        <span>Filters</span>

        {activeCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#15803d] px-1.5 text-[10px] text-white">
            {activeCount}
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center [&>*]:w-full sm:[&>*]:w-auto">
        {children}
      </div>

      {onReset && activeCount > 0 && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onReset}
          className="shrink-0 self-end sm:self-auto"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Reset
        </Button>
      )}
    </div>
  );
}