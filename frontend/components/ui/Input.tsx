import * as React from "react";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  required?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { label, hint, error, required, className = "", id, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="min-w-0 space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-bold text-[#344239]"
          >
            {label}
            {required && <span className="ml-1 text-[#15803d]">*</span>}
          </label>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={Boolean(error)}
          className={[
            "min-h-11 w-full min-w-0 rounded-xl border bg-white px-3 text-base text-[#142018] sm:h-10 sm:text-sm",
            "outline-none transition placeholder:text-[#9aa69e]",
            "focus:border-[#22a052] focus:ring-4 focus:ring-[#22a052]/10",
            error
              ? "border-red-300 focus:border-red-500 focus:ring-red-500/10"
              : "border-[#d9e3db]",
            "disabled:cursor-not-allowed disabled:bg-[#f5f7f5] disabled:text-[#8b968e]",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
          {...props}
        />

        {error ? (
          <p className="break-words text-xs font-medium text-red-600">{error}</p>
        ) : hint ? (
          <p className="break-words text-xs text-[#718078]">{hint}</p>
        ) : null}
      </div>
    );
  },
);