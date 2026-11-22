import * as React from "react";
import { X } from "lucide-react";

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  side?: "left" | "right";
  width?: "sm" | "md" | "lg";
}

const widths = {
  sm: "w-full max-w-[calc(100vw-1.5rem)] sm:max-w-sm",
  md: "w-full max-w-[calc(100vw-1.5rem)] sm:max-w-md",
  lg: "w-full max-w-[calc(100vw-1rem)] sm:max-w-xl",
};

export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  side = "right",
  width = "md",
}: DrawerProps) {
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

  const isRight = side === "right";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-[100] overscroll-none"
    >
      <div
        className="absolute inset-0 bg-[#071a10]/45 backdrop-blur-[2px]"
        onClick={onClose}
      />

      <aside
        className={[
          "absolute top-0 flex h-dvh max-h-dvh min-w-0 flex-col bg-white shadow-2xl shadow-[#071a10]/20",
          widths[width],
          isRight ? "right-0" : "left-0",
        ]
          .filter(Boolean)
          .join(" ")}
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
      </aside>
    </div>
  );
}