import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastTone = "success" | "error" | "info";

interface ToastProps {
  open: boolean;
  message: string;
  tone?: ToastTone;
  onClose: () => void;
  title?: string;
}

const tones = {
  success: {
    icon: CheckCircle2,
    iconClass: "text-[#15803d] bg-[#effaf3]",
  },
  error: {
    icon: XCircle,
    iconClass: "text-red-600 bg-red-50",
  },
  info: {
    icon: Info,
    iconClass: "text-[#166534] bg-[#effaf3]",
  },
};

export function Toast({
  open,
  message,
  tone = "success",
  onClose,
  title,
}: ToastProps) {
  if (!open) return null;

  const Icon = tones[tone].icon;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className="fixed inset-x-3 top-3 z-[200] sm:inset-x-auto sm:right-4 sm:top-4 sm:w-full sm:max-w-[380px]"
    >
      <div className="flex min-w-0 items-start gap-3 rounded-2xl border border-[#dce5de] bg-white p-3.5 shadow-2xl shadow-[#071a10]/15">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone].iconClass}`}
        >
          <Icon className="h-4.5 w-4.5 shrink-0" />
        </div>

        <div className="min-w-0 flex-1">
          {title && (
            <p className="break-words text-xs font-black text-[#25332a]">
              {title}
            </p>
          )}
          <p
            className={`${title ? "mt-0.5" : ""} break-words text-xs leading-5 text-[#647067]`}
          >
            {message}
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#8a968e] transition hover:bg-[#f0f4f1] hover:text-[#142018] sm:h-7 sm:w-7"
          aria-label="Close notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}