"use client";

import React, { useCallback, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";

interface SaleItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface ReceiptPayload {
  store_info?: {
    name?: string;
    branch?: string;
    phone?: string;
    currency?: string;
    pin?: string;
  };
  transaction?: {
    sale_id?: number;
    sale_number?: string;
    receipt_number?: string;
    payment_status?: string;
    payment_method?: string;
  };
  items?: SaleItem[];
  totals?: {
    subtotal?: number;
    tax?: number;
    grand_total?: number;
  };
  ai_insight?: string;
}

interface ReceiptInfo {
  receipt_number: string;
  is_printed: boolean;
  is_revoked?: boolean;
  receipt_payload?: ReceiptPayload;
  payload?: ReceiptPayload;
}

interface SaleDataResponse {
  sale_number?: string;
  payment_status?: string;
  receipt?: ReceiptInfo;
}

interface ReceiptModalProps {
  saleData: SaleDataResponse | null;
  receiptInfo: ReceiptInfo | null;
  onClose: () => void;
  onPrintSuccess?: () => void;
}

export default function ReceiptModal({
  saleData,
  receiptInfo,
  onClose,
  onPrintSuccess,
}: ReceiptModalProps) {
  const receiptNumber = receiptInfo?.receipt_number;
  const payload: ReceiptPayload =
    saleData?.receipt?.receipt_payload ||
    saleData?.receipt?.payload ||
    receiptInfo?.receipt_payload ||
    receiptInfo?.payload ||
    {};

  const saleNumber =
    payload.transaction?.sale_number || saleData?.sale_number || "";
  const paymentStatus =
    payload.transaction?.payment_status || saleData?.payment_status || "";

  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  const handlePrint = useCallback(async () => {
    if (!receiptNumber) return;

    window.print();

    try {
      const token = getToken() || undefined;
      await apiFetch(`/api/receipts/${receiptNumber}/print/`, {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });

      if (onPrintSuccess) onPrintSuccess();
    } catch (err) {
      console.error("Failed to update print status:", err);
    } finally {
      onClose();
    }
  }, [receiptNumber, onClose, onPrintSuccess]);

  const printRef = useRef(handlePrint);
  const skipRef = useRef(handleSkip);

  useEffect(() => {
    printRef.current = handlePrint;
    skipRef.current = handleSkip;
  }, [handlePrint, handleSkip]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        void printRef.current();
      } else if (e.key === "Escape") {
        e.preventDefault();
        skipRef.current();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Sale receipt"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-4"
    >
      <div className="max-h-[92dvh] w-full max-w-md min-w-0 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-4 text-slate-100 shadow-2xl sm:p-6">
        <div className="no-print border-b border-slate-800 pb-3.5 text-center sm:pb-4">
          <h2 className="text-lg font-bold text-emerald-400 sm:text-xl">
            Sale Completed
          </h2>
          <p className="mt-1 break-words text-xs text-slate-400 sm:text-sm">
            Receipt:{" "}
            <span className="font-mono text-slate-200">{receiptNumber}</span>
            {saleNumber && (
              <>
                {" · "}Sale:{" "}
                <span className="font-mono text-slate-200">{saleNumber}</span>
              </>
            )}
          </p>
          {paymentStatus && paymentStatus !== "paid" && (
            <p className="mt-1 text-xs text-amber-400">
              Payment status: {paymentStatus.replaceAll("_", " ")}
            </p>
          )}
        </div>

        <div className="thermal-receipt my-3.5 max-h-56 min-w-0 overflow-y-auto overscroll-contain rounded bg-slate-950 p-3 font-mono text-xs text-slate-300 sm:my-4">
          <div className="mb-2 break-words text-center font-bold">
            {payload.store_info?.name || "BuildOps Hardware"}
          </div>
          <div className="mb-2 break-words text-center text-[11px] opacity-80">
            <div>Rcpt: {receiptNumber}</div>
            {saleNumber && <div>Sale: {saleNumber}</div>}
          </div>
          <div className="mb-2 border-b border-dashed border-slate-700 pb-2">
            {payload.items?.map((item, idx) => (
              <div
                key={idx}
                className="flex items-start justify-between gap-2 py-0.5"
              >
                <span className="min-w-0 flex-1 break-words">
                  {item.quantity}x {item.item_name}
                </span>
                <span className="shrink-0 whitespace-nowrap">
                  KES {Number(item.total_price).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 font-bold">
            <span>Grand Total:</span>
            <span className="shrink-0 whitespace-nowrap">
              KES {Number(payload.totals?.grand_total ?? 0).toLocaleString()}
            </span>
          </div>
          {payload.ai_insight && (
            <div className="mt-2 break-words border-t border-dashed border-slate-700 pt-2 text-[10px] italic">
              {payload.ai_insight}
            </div>
          )}
        </div>

        <p className="no-print mb-4 break-words text-center text-xs text-slate-400 sm:mb-5">
          Choose your thermal printer in the browser print dialog rather than
          Save as PDF.
        </p>

        <div className="no-print flex flex-col-reverse gap-2.5 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={handleSkip}
            className="min-h-11 flex-1 rounded-lg bg-slate-800 px-3 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-700 touch-manipulation"
          >
            Skip [Esc]
          </button>
          <button
            type="button"
            onClick={() => void handlePrint()}
            className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-3 py-2.5 text-sm font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-500 touch-manipulation"
          >
            Print Receipt [Enter]
          </button>
        </div>
      </div>
    </div>
  );
}