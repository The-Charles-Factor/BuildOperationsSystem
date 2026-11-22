import type { ReactNode } from "react";

export type Column<T = Record<string, unknown>> = {
  key: string;
  /** Preferred label field. */
  label?: string;
  /** Backward-compatible alias. */
  header?: string;
  align?: "left" | "right" | "center";
  width?: string;
  render?: (row: T, index: number) => ReactNode;
  hideBelow?: "sm" | "md" | "lg";
  headerClassName?: string;
  cellClassName?: string;
};

export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  emptyMessage = "No records found.",
  rowKey,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  emptyMessage?: string;
  rowKey?: (row: T, index: number) => string | number;
  onRowClick?: (row: T) => void;
}) {
  const alignClass = (a?: Column<T>["align"]) =>
    a === "right" ? "text-right" : a === "center" ? "text-center" : "text-left";

  const hideClass = (b?: Column<T>["hideBelow"]) =>
    b === "sm"
      ? "hidden sm:table-cell"
      : b === "md"
        ? "hidden md:table-cell"
        : b === "lg"
          ? "hidden lg:table-cell"
          : "";

  return (
    <div className="w-full min-w-0 overflow-x-auto overscroll-x-contain">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border-soft)" }}>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`whitespace-nowrap px-3.5 py-2.5 text-[11px] font-medium uppercase tracking-[0.06em] sm:px-5 ${alignClass(c.align)} ${hideClass(c.hideBelow)} ${c.headerClassName ?? ""}`}
                style={{ color: "var(--charcoal-400)", width: c.width }}
              >
                {c.header ?? c.label}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 && (
            <tr>
              <td
                colSpan={columns.length}
                className="px-4 py-12 text-center text-[12.5px] sm:px-5 sm:py-14"
                style={{ color: "var(--charcoal-400)" }}
              >
                {emptyMessage}
              </td>
            </tr>
          )}

          {rows.map((row, i) => (
            <tr
              key={rowKey ? rowKey(row, i) : i}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className="bo-transition"
              style={{ borderBottom: "1px solid var(--border-soft)" }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--emerald-50)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`px-3.5 py-3 align-middle sm:px-5 ${alignClass(c.align)} ${hideClass(c.hideBelow)} ${c.cellClassName ?? ""}`}
                  style={{
                    color: "var(--charcoal-700)",
                    cursor: onRowClick ? "pointer" : undefined,
                  }}
                >
                  {c.render ? c.render(row, i) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}