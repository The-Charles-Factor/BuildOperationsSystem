import * as React from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  loadingText?: string;
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#15803d] text-white shadow-sm hover:bg-[#166534] focus-visible:ring-[#22a052]/30",
  secondary:
    "bg-[#ecfdf3] text-[#166534] hover:bg-[#dcfce7] focus-visible:ring-[#22a052]/20",
  danger:
    "bg-[#dc2626] text-white shadow-sm hover:bg-[#b91c1c] focus-visible:ring-red-500/25",
  ghost:
    "bg-transparent text-[#526057] hover:bg-[#f0f4f1] hover:text-[#142018] focus-visible:ring-[#22a052]/20",
  outline:
    "border border-[#d9e3db] bg-white text-[#25332a] hover:border-[#b9c7bc] hover:bg-[#f8faf8] focus-visible:ring-[#22a052]/20",
};

const sizes = {
  sm: "min-h-9 sm:h-8 rounded-lg px-2.5 sm:px-3 text-xs",
  md: "min-h-10 rounded-xl px-3.5 sm:px-4 text-sm",
  lg: "min-h-11 rounded-xl px-4 sm:px-5 text-sm",
};

export function Button({
  variant = "primary",
  loading = false,
  loadingText,
  size = "md",
  fullWidth = false,
  disabled,
  children,
  className = "",
  type = "button",
  leftIcon,
  rightIcon,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={[
        "inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold transition-all duration-200 touch-manipulation",
        "focus:outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-50",
        variants[variant],
        sizes[size],
        fullWidth ? "w-full" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        leftIcon && <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
      )}
      {loading && loadingText ? loadingText : children}
      {!loading && rightIcon && (
        <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
      )}
    </button>
  );
}