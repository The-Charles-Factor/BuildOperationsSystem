import * as React from "react";
import { Search, X } from "lucide-react";

interface SearchBarProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  className?: string;
}

export function SearchBar({
  value,
  onChange,
  onClear,
  placeholder = "Search...",
  className = "",
  ...props
}: SearchBarProps) {
  return (
    <div
      className={[
        "relative flex min-h-11 w-full min-w-0 items-center rounded-xl border border-[#dce5de] bg-white transition sm:h-10",
        "focus-within:border-[#22a052] focus-within:ring-4 focus-within:ring-[#22a052]/10",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Search className="ml-3 h-4 w-4 shrink-0 text-[#8a968e]" />

      <input
        {...props}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-full min-w-0 flex-1 bg-transparent px-2.5 text-base text-[#142018] outline-none placeholder:text-[#9aa69e] sm:text-sm"
      />

      {value && (
        <button
          type="button"
          onClick={onClear ?? (() => onChange(""))}
          className="mr-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a968e] transition hover:bg-[#f0f4f1] hover:text-[#142018] sm:h-7 sm:w-7"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}