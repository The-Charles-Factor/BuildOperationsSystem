import * as React from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  label?: string;
  hint?: string;
  error?: string;
  options: SelectOption[];
  required?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select(
    { label, hint, error, options, required, className = "", id, children, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const selectId = id ?? generatedId;

    return (
      <div className="min-w-0 space-y-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="block text-xs font-bold text-[#344239]"
          >
            {label}
            {required && <span className="ml-1 text-[#15803d]">*</span>}
          </label>
        )}

        <div className="relative min-w-0">
          <select
            ref={ref}
            id={selectId}
            aria-invalid={Boolean(error)}
            className={[
              "min-h-11 w-full min-w-0 appearance-none truncate rounded-xl border bg-white px-3 pr-10 text-base text-[#142018] sm:h-10 sm:text-sm",
              "outline-none transition focus:border-[#22a052] focus:ring-4 focus:ring-[#22a052]/10",
              error
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
                : "border-[#d9e3db]",
              "disabled:cursor-not-allowed disabled:bg-[#f5f7f5] disabled:text-[#8b968e]",
              className,
            ]
              .filter(Boolean)
              .join(" ")}
            {...props}
          >
            {children ??
              options.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.disabled}
                >
                  {option.label}
                </option>
              ))}
          </select>

          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 shrink-0 -translate-y-1/2 text-[#7a877f]" />
        </div>

        {error ? (
          <p className="break-words text-xs font-medium text-red-600">{error}</p>
        ) : hint ? (
          <p className="break-words text-xs text-[#718078]">{hint}</p>
        ) : null}
      </div>
    );
  },
);