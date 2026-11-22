import { Loader2 } from "lucide-react";

interface SpinnerProps {
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  xs: "h-3 w-3",
  sm: "h-4 w-4",
  md: "h-6 w-6",
  lg: "h-9 w-9",
};

export function Spinner({
  size = "md",
  className = "",
}: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className="inline-flex shrink-0 items-center justify-center"
    >
      <Loader2
        className={`shrink-0 animate-spin text-[#15803d] ${sizes[size]} ${className}`}
      />
      <span className="sr-only">Loading…</span>
    </span>
  );
}