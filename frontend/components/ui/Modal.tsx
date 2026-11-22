import * as React from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnOverlay?: boolean;
}

const sizes = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  size = "md",
  closeOnOverlay = true,
}: ModalProps) {
  React.useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overscroll-none">
      <div
        className="absolute inset-0 bg-[#071a10]/55 backdrop-blur-[3px]"
        onMouseDown={() => closeOnOverlay && onClose()}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex max-h-[90dvh] w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-[#dce6de] bg-white shadow-2xl shadow-[#071a10]/20 ${sizes[size]}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#e7ece8] px-4 py-3.5 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <h2 className="break-words text-base font-black tracking-[-0.02em] text-[#142018]">
              {title}
            </h2>
            {description && (
              <p className="mt-1 break-words text-xs leading-5 text-[#718078]">
                {description}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[#7a877f] transition hover:bg-[#f0f4f1] hover:text-[#142018]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
          {children}
        </div>
      </div>
    </div>
  );
}