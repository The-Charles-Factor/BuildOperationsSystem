import type { ReactNode } from "react";

type StatusKey =
  | "paid" | "pending" | "shipped" | "cancelled"
  | "active" | "inactive" | "low_stock" | "out_of_stock"
  | "draft" | "completed"
  | "ordered" | "partially_received" | "received"
  | "unpaid" | "partially_paid" | "returned";

type Tone = { bg: string; fg: string; border: string; dot: string };

const SUCCESS: Tone = {
  bg: "var(--emerald-50)",
  fg: "var(--emerald-700)",
  border: "var(--emerald-200)",
  dot: "var(--emerald-500)",
};
const WARNING: Tone = {
  bg: "#fffbeb",
  fg: "var(--warning)",
  border: "var(--warning-border)",
  dot: "#d97706",
};
const DANGER: Tone = {
  bg: "#fef2f2",
  fg: "var(--danger)",
  border: "var(--danger-border)",
  dot: "#dc2626",
};
const NEUTRAL: Tone = {
  bg: "var(--workspace)",
  fg: "var(--charcoal-500)",
  border: "var(--border)",
  dot: "var(--charcoal-300)",
};
const INFO: Tone = {
  bg: "#eff6ff",
  fg: "#1d4ed8",
  border: "#bfdbfe",
  dot: "#3b82f6",
};

const TONE: Record<StatusKey, Tone> = {
  paid:               SUCCESS,
  completed:          SUCCESS,
  active:             SUCCESS,
  received:           SUCCESS,
  shipped:            { ...SUCCESS, border: "var(--emerald-100)", dot: "var(--emerald-400)" },
  pending:            WARNING,
  low_stock:          WARNING,
  partially_paid:     WARNING,
  partially_received: WARNING,
  returned:           WARNING,
  ordered:            INFO,
  draft:              NEUTRAL,
  inactive:           NEUTRAL,
  cancelled:          DANGER,
  out_of_stock:       DANGER,
  unpaid:             DANGER,
};

const DEFAULT_TONE: Tone = NEUTRAL;

export function StatusBadge(
  props:
    | { status: string; variant?: never; children?: never }
    | { variant: string; children: ReactNode; status?: never }
) {
  const key = (
    "status" in props && props.status
      ? props.status
      : "variant" in props && props.variant
        ? props.variant
        : ""
  )
    .toLowerCase()
    .replace(/\s+/g, "_") as StatusKey;

  const t = TONE[key] ?? DEFAULT_TONE;

  const label =
    "children" in props && props.children
      ? props.children
      : key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <span
      className="inline-flex h-[22px] max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full pl-1.5 pr-2 text-[11.5px] font-medium"
      style={{ background: t.bg, color: t.fg, border: `1px solid ${t.border}` }}
    >
      <span
        className="h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ background: t.dot }}
      />
      <span className="truncate">{label}</span>
    </span>
  );
}