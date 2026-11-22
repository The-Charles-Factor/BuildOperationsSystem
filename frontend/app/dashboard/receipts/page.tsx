"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  Pagination,
  SearchBar,
  Select,
  StatCard,
  StatusBadge,
} from "@/components";
import type { Column } from "@/components";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/Pagination";

type ReceiptItem = {
  item_name: string;
  quantity: number | string;
  unit_price: number | string;
  total_price: number | string;
};

type ReceiptPayload = {
  store_info?: {
    name?: string;
    branch?: string;
    phone?: string;
    currency?: string;
    pin?: string;
  };
  transaction?: {
    sale_id?: number | string;
    sale_number?: string;
    receipt_number?: string;
    completed_at?: string;
    cashier?: string;
    payment_method?: string;
    payment_status?: string;
  };
  items?: ReceiptItem[];
  totals?: {
    subtotal?: number | string;
    tax?: number | string;
    grand_total?: number | string;
  };
  ai_insight?: string;
};

type ReceiptRecord = {
  id: number;
  receipt_number: string;
  sale_number?: string | null;
  is_printed: boolean;
  is_revoked?: boolean;
  revoked_at?: string | null;
  revoked_reason?: string;
  print_attempts: number;
  last_printed_at: string | null;
  receipt_payload: ReceiptPayload;
  created_at: string;
};

const printFilterOptions = [
  { value: "all", label: "All receipts" },
  { value: "printed", label: "Printed" },
  { value: "unprinted", label: "Not printed" },
  { value: "revoked", label: "Revoked" },
];

function money(value: string | number | null | undefined) {
  const amount = Number(value || 0);
  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
  });
}

function getSaleRef(receipt: ReceiptRecord) {
  return (
    receipt.sale_number ||
    receipt.receipt_payload?.transaction?.sale_number ||
    (receipt.receipt_payload?.transaction?.sale_id
      ? `Sale #${receipt.receipt_payload.transaction.sale_id}`
      : "—")
  );
}

export default function ReceiptsPage() {
  const token = getToken();
  const previewRef = useRef<HTMLElement | null>(null);

  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<ReceiptRecord | null>(
    null,
  );
  const [pendingReprintReceipt, setPendingReprintReceipt] =
    useState<ReceiptRecord | null>(null);
  const [search, setSearch] = useState("");
  const [printFilter, setPrintFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [printingId, setPrintingId] = useState<number | null>(null);
  const [error, setError] = useState("");

  const loadReceipts = useCallback(async () => {
    if (!token) {
      setError("You are not authenticated. Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await apiFetch<ReceiptRecord[]>("/api/receipts/", {
        token,
      });
      const list = Array.isArray(data) ? data : [];
      setReceipts(list);
      setSelectedReceipt((prev) => {
        if (!prev) return list[0] ?? null;
        return list.find((item) => item.id === prev.id) ?? list[0] ?? null;
      });
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load receipts. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadReceipts();
  }, [loadReceipts]);

  function handlePreview(receipt: ReceiptRecord) {
    setSelectedReceipt(receipt);
    previewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  async function executePrintReceipt(receipt: ReceiptRecord) {
    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (receipt.is_revoked) {
      setError(
        "This receipt has been revoked because the sale was returned or cancelled.",
      );
      return;
    }

    try {
      setPrintingId(receipt.id);
      setError("");
      setSelectedReceipt(receipt);

      // Browser print dialog is controlled by Chrome/OS: if no physical thermal printer
      // is selected in Destination, it defaults to "Save as PDF" (showing Save / Cancel).
      window.print();

      await apiFetch(`/api/receipts/${receipt.receipt_number}/print/`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });

      await loadReceipts();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to record receipt print action.",
      );
    } finally {
      setPrintingId(null);
      setPendingReprintReceipt(null);
    }
  }

  function handlePrintClick(receipt: ReceiptRecord) {
    if (receipt.is_revoked) {
      setError(
        "This receipt has been revoked because the sale was returned or cancelled.",
      );
      return;
    }

    if (receipt.is_printed || receipt.print_attempts > 0) {
      setPendingReprintReceipt(receipt);
      return;
    }

    void executePrintReceipt(receipt);
  }

  const filteredReceipts = useMemo(() => {
    const q = search.toLowerCase().trim();

    return receipts.filter((receipt) => {
      const saleRef = getSaleRef(receipt).toLowerCase();
      const cashier =
        receipt.receipt_payload?.transaction?.cashier?.toLowerCase() || "";
      const matchesSearch =
        !q ||
        receipt.receipt_number.toLowerCase().includes(q) ||
        saleRef.includes(q) ||
        cashier.includes(q);

      const matchesPrint =
        printFilter === "all" ||
        (printFilter === "revoked" && Boolean(receipt.is_revoked)) ||
        (printFilter === "printed" &&
          !receipt.is_revoked &&
          receipt.is_printed) ||
        (printFilter === "unprinted" &&
          !receipt.is_revoked &&
          !receipt.is_printed);

      return matchesSearch && matchesPrint;
    });
  }, [receipts, search, printFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, printFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredReceipts.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedReceipts = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredReceipts.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredReceipts, page]);

  const printedCount = receipts.filter(
    (r) => !r.is_revoked && r.is_printed,
  ).length;
  const totalPrintCopies = receipts.reduce(
    (sum, r) => sum + (r.print_attempts || 0),
    0,
  );
  const unprintedCount = receipts.filter(
    (r) => !r.is_revoked && !r.is_printed,
  ).length;
  const revokedCount = receipts.filter((r) => Boolean(r.is_revoked)).length;

  function resetFilters() {
    setSearch("");
    setPrintFilter("all");
    setPage(1);
  }

  const columns: Column<ReceiptRecord>[] = [
    {
      key: "receipt_number",
      label: "Receipt & Sale",
      render: (receipt) => (
        <div className="min-w-0">
          <p className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
            {receipt.receipt_number}
          </p>
          <p className="break-all font-mono text-xs text-[var(--charcoal-700)]">
            Sale: {getSaleRef(receipt)}
          </p>
          <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
            {formatDate(receipt.created_at)}
          </p>
        </div>
      ),
    },
    {
      key: "total",
      label: "Total",
      render: (receipt) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {money(receipt.receipt_payload?.totals?.grand_total)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      hideBelow: "sm",
      render: (receipt) => (
        <StatusBadge
          status={
            receipt.is_revoked
              ? "revoked"
              : receipt.is_printed
                ? "printed"
                : "not_printed"
          }
        />
      ),
    },
    {
      key: "print_attempts",
      label: "Prints",
      hideBelow: "md",
      render: (receipt) => (
        <span className="tabular-nums text-sm text-[var(--charcoal-700)]">
          {receipt.print_attempts}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (receipt) => {
        const isAlreadyPrinted = Boolean(
          !receipt.is_revoked &&
            (receipt.is_printed || receipt.print_attempts > 0),
        );

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant={
                selectedReceipt?.id === receipt.id ? "primary" : "outline"
              }
              onClick={() => handlePreview(receipt)}
            >
              Preview
            </Button>
            <Button
              size="sm"
              variant={isAlreadyPrinted ? "outline" : "primary"}
              disabled={Boolean(receipt.is_revoked)}
              loading={printingId === receipt.id}
              onClick={() => handlePrintClick(receipt)}
            >
              {receipt.is_revoked
                ? "Revoked"
                : isAlreadyPrinted
                  ? "Reprint (Caution)"
                  : "Print"}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Receipts"
        subtitle={`${printedCount.toLocaleString()} printed receipts (${totalPrintCopies.toLocaleString()} total print runs). Review sale links, revocations, and reprint only with caution.`}
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Receipts" },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface-muted)] px-3 py-1.5 text-xs font-medium text-[var(--charcoal-800)]">
              Printed receipts: <strong>{printedCount.toLocaleString()}</strong>
            </span>
            <Button
              variant="outline"
              onClick={() => void loadReceipts()}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Receipts error"
          message={error}
          action={
            <Button
              size="sm"
              variant="outline"
              onClick={() => void loadReceipts()}
            >
              Retry
            </Button>
          }
        />
      )}

      {pendingReprintReceipt && (
        <div className="no-print min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="break-words text-sm font-semibold">
                Caution: Reprint Receipt {pendingReprintReceipt.receipt_number} (
                {getSaleRef(pendingReprintReceipt)})?
              </p>
              <p className="mt-0.5 break-words text-xs text-amber-900">
                Already printed {pendingReprintReceipt.print_attempts} time(s)
                {pendingReprintReceipt.last_printed_at
                  ? ` · Last printed ${formatDate(pendingReprintReceipt.last_printed_at)}`
                  : ""}
                . Reprinting creates a duplicate copy.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPendingReprintReceipt(null)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                loading={printingId === pendingReprintReceipt.id}
                onClick={() => void executePrintReceipt(pendingReprintReceipt)}
              >
                Confirm Reprint
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total receipts"
          value={receipts.length.toLocaleString()}
          hint="All completed sales"
          tone="default"
        />
        <StatCard
          label="Receipts printed"
          value={printedCount.toLocaleString()}
          hint={`${totalPrintCopies.toLocaleString()} total print runs`}
          tone="default"
        />
        <StatCard
          label="Not printed"
          value={unprintedCount.toLocaleString()}
          hint="Skipped or pending print"
          tone={unprintedCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Revoked"
          value={revokedCount.toLocaleString()}
          hint="Returned or cancelled sales"
          tone={revokedCount > 0 ? "warning" : "default"}
        />
      </div>

      <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="no-print min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
          <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 sm:grid-cols-[minmax(180px,1fr)_170px_auto]">
            <SearchBar
              value={search}
              onChange={setSearch}
              onClear={() => setSearch("")}
              placeholder="Search receipt #, sale #, or cashier..."
            />
            <Select
              value={printFilter}
              onChange={(e) => setPrintFilter(e.target.value)}
              options={printFilterOptions}
              aria-label="Filter receipt status"
            />
            <Button variant="outline" onClick={resetFilters}>
              Reset
            </Button>
          </div>

          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <p className="text-sm text-[var(--charcoal-500)]">
              Showing{" "}
              <span className="font-semibold text-[var(--charcoal-800)]">
                {filteredReceipts.length}
              </span>{" "}
              of {receipts.length} receipts
            </p>
          </div>

          {loading ? (
            <div className="p-4">
              <LoadingState rows={5} />
            </div>
          ) : filteredReceipts.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState
                title="No receipts found"
                hint="Receipts are created automatically when sales are completed."
                action={
                  receipts.length > 0 ? (
                    <Button variant="outline" onClick={resetFilters}>
                      Reset filters
                    </Button>
                  ) : undefined
                }
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={columns}
                rows={paginatedReceipts}
                rowKey={(r) => r.id}
                emptyMessage="No receipts found."
              />
              <Pagination
                page={page}
                pageSize={DEFAULT_PAGE_SIZE}
                totalItems={filteredReceipts.length}
                onPageChange={setPage}
              />
            </>
          )}
        </section>

        <section
          ref={previewRef}
          className="min-w-0 rounded-xl border border-[var(--border)] bg-white p-4 shadow-[var(--shadow-card)] sm:p-5"
        >
          <h2 className="no-print font-semibold text-[var(--charcoal-900)]">
            Receipt preview
          </h2>
          <p className="no-print mt-1 text-xs text-[var(--charcoal-500)]">
            Saved snapshot from time of sale completion. If the browser print
            sheet shows Save instead of Print, select your thermal printer under
            Destination.
          </p>

          {!selectedReceipt ? (
            <p className="mt-6 text-sm text-[var(--charcoal-500)]">
              Select a receipt to inspect its details.
            </p>
          ) : (
            <div className="thermal-receipt mt-4 min-w-0 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-4 font-mono text-xs text-[var(--charcoal-800)]">
              <div className="text-center">
                <p className="break-words text-sm font-bold text-[var(--charcoal-900)]">
                  {selectedReceipt.receipt_payload?.store_info?.name ||
                    "BuildOps"}
                </p>
                <p className="break-words text-[11px] text-[var(--charcoal-500)]">
                  {selectedReceipt.receipt_payload?.store_info?.branch || ""}
                </p>
                <p className="mt-1 break-all text-[11px]">
                  Rcpt: {selectedReceipt.receipt_number}
                </p>
                <p className="break-all text-[11px]">
                  Sale: {getSaleRef(selectedReceipt)}
                </p>
              </div>

              {selectedReceipt.is_revoked && (
                <div className="mt-2 break-words rounded border border-red-300 bg-red-50 p-2 text-center text-[11px] font-semibold text-red-700">
                  REVOKED
                  {selectedReceipt.revoked_reason
                    ? ` — ${selectedReceipt.revoked_reason}`
                    : ""}
                </div>
              )}

              <div className="my-3 space-y-1.5 border-y border-dashed border-[var(--border)] py-3">
                {(selectedReceipt.receipt_payload?.items || []).map(
                  (item, idx) => (
                    <div key={idx} className="flex justify-between gap-2">
                      <span className="min-w-0 break-words">
                        {item.quantity}x {item.item_name}
                      </span>
                      <span className="shrink-0 tabular-nums">
                        {money(item.total_price)}
                      </span>
                    </div>
                  ),
                )}
              </div>

              <div className="space-y-1">
                <div className="flex justify-between gap-2">
                  <span>Subtotal</span>
                  <span className="tabular-nums">
                    {money(selectedReceipt.receipt_payload?.totals?.subtotal)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span>Tax</span>
                  <span className="tabular-nums">
                    {money(selectedReceipt.receipt_payload?.totals?.tax)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-[var(--border)] pt-1.5 text-sm font-bold text-[var(--charcoal-900)]">
                  <span>Grand total</span>
                  <span className="tabular-nums">
                    {money(selectedReceipt.receipt_payload?.totals?.grand_total)}
                  </span>
                </div>
              </div>

              {selectedReceipt.receipt_payload?.ai_insight && (
                <p className="mt-3 break-words border-t border-dashed border-[var(--border)] pt-2.5 text-[11px] italic text-[var(--charcoal-600)]">
                  AI Note: {selectedReceipt.receipt_payload.ai_insight}
                </p>
              )}

              <div className="no-print mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--charcoal-500)]">
                <span>
                  {selectedReceipt.is_revoked
                    ? "Revoked"
                    : selectedReceipt.is_printed
                      ? "Printed"
                      : "Not printed"}
                </span>
                <span>Attempts: {selectedReceipt.print_attempts}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}