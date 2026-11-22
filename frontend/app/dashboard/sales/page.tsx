"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  Modal,
  PageHeader,
  Pagination,
  SearchBar,
  Select,
  StatCard,
  StatusBadge,
} from "@/components";
import type { Column } from "@/components";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/Pagination";

import ReceiptModal from "@/components/ui/ReceiptModal";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type MeResponse = {
  role?: string | null;
  can_view_totals?: boolean;
};

type Customer = {
  id: number;
  name?: string;
  customer_name?: string;
  phone?: string;
};

type Product = {
  id: number;
  sku: string;
  name: string;
  selling_price: string;
  tax_rate: string;
};

type SaleItem = {
  id: number;
  sale: number;
  product: number;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  discount_amount: string;
  line_total: string;
  created_at: string;
};

type SalePayment = {
  id: number;
  sale: number;
  amount: string;
  payment_method: string;
  reference: string | null;
  notes: string | null;
  received_by: number | null;
  created_at: string;
};

type SaleReturnItem = {
  id: number;
  sale_return: number;
  sale_item: number;
  quantity: string;
  created_at: string;

  /* Optional so the page stays compatible with the current API. */
  sold_quantity?: string;
  returned_quantity?: string;
  available_quantity?: string;
  estimated_refund?: string;
};

type SaleRefund = {
  id: number;
  refund_number: string;
  sale: number;
  sale_return?: number | null;
  amount: string;
  subtotal_amount?: string;
  tax_amount?: string;
  refund_method: string;
  reference: string | null;
  reason: string;
  processed_by: number | null;
  created_at: string;
};

type SaleReturn = {
  id: number;
  return_number: string;
  sale: number;
  reason: string;
  status: string;
  created_by: number | null;
  created_at: string;
  items: SaleReturnItem[];

  refund?: SaleRefund | null;
  refund_amount?: string;
  return_total?: string;
  return_tax?: string;
};

type Sale = {
  id: number;
  sale_number: string;
  customer: number | null;
  sale_date: string;
  status: string;
  payment_status: string;
  payment_method: string;

  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_paid: string;

  /* Expected from the upgraded backend; optional for older responses. */
  refunded_amount?: string;
  net_total?: string;
  net_amount_paid?: string;
  net_tax_amount?: string;

  notes: string | null;
  created_by: number | null;
  created_at: string;
  updated_at: string;

  items: SaleItem[];
};

type SaleFormItem = {
  product: string;
  quantity: string;
  unit_price: string;
  tax_rate: string;
  discount_amount: string;
};

type SaleForm = {
  sale_number: string;
  customer: string;
  payment_method: string;
  notes: string;
  items: SaleFormItem[];
};

type PaymentForm = {
  sale: string;
  amount: string;
  payment_method: string;
  reference: string;
  notes: string;
};

type ReturnFormItem = {
  sale_item: string;
  quantity: string;
};

type ReturnForm = {
  sale: string;
  reason: string;
  items: ReturnFormItem[];
};

type RefundForm = {
  returnId: number | null;
  refundMethod: string;
  reference: string;
};

type ConfirmTarget =
  | { kind: "complete_sale"; sale: Sale }
  | { kind: "delete_sale"; sale: Sale }
  | { kind: "cancel_return"; saleReturn: SaleReturn }
  | null;

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const emptySaleItem: SaleFormItem = {
  product: "",
  quantity: "1",
  unit_price: "",
  tax_rate: "0",
  discount_amount: "0",
};

const emptySaleForm: SaleForm = {
  sale_number: "",
  customer: "",
  payment_method: "cash",
  notes: "",
  items: [{ ...emptySaleItem }],
};

const emptyPaymentForm: PaymentForm = {
  sale: "",
  amount: "",
  payment_method: "cash",
  reference: "",
  notes: "",
};

const emptyReturnForm: ReturnForm = {
  sale: "",
  reason: "",
  items: [],
};

const emptyRefundForm: RefundForm = {
  returnId: null,
  refundMethod: "cash",
  reference: "",
};

const fieldClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 disabled:bg-[var(--surface-muted)] disabled:text-[var(--charcoal-500)] sm:min-h-0 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

const saleStatusOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "returned", label: "Returned" },
];

const paymentStatusOptions = [
  { value: "all", label: "All payments" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

const saleMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "credit", label: "Credit" },
];

const paymentMethodOptions = saleMethodOptions.filter(
  (option) => option.value !== "credit",
);

function money(value: string | number | null | undefined) {
  const amount = Number(value || 0);

  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatStatus(value: string) {
  return value.replaceAll("_", " ");
}

function FormField({
  label,
  children,
  required = false,
}: {
  label: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div
      className={
        strong
          ? "flex items-center justify-between gap-3 text-sm font-semibold text-[var(--charcoal-900)]"
          : "flex items-center justify-between gap-3 text-sm text-[var(--charcoal-600)]"
      }
    >
      <span className="min-w-0">{label}</span>
      <span className="shrink-0 tabular-nums">{value}</span>
    </div>
  );
}

function ModalError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </p>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SalesPage() {
  const token = getToken();

  const [canViewTotals, setCanViewTotals] = useState(false);

  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [payments, setPayments] = useState<SalePayment[]>([]);
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [refunds, setRefunds] = useState<SaleRefund[]>([]);

  const [saleForm, setSaleForm] = useState<SaleForm>(emptySaleForm);
  const [paymentForm, setPaymentForm] =
    useState<PaymentForm>(emptyPaymentForm);
  const [returnForm, setReturnForm] = useState<ReturnForm>(emptyReturnForm);
  const [refundForm, setRefundForm] = useState<RefundForm>(emptyRefundForm);

  const [editingSaleId, setEditingSaleId] = useState<number | null>(null);
  const [editingReturnId, setEditingReturnId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [activeReceiptData, setActiveReceiptData] = useState<any>(null);
  const [activeReceiptInfo, setActiveReceiptInfo] = useState<{
    receipt_number: string;
    is_printed: boolean;
  } | null>(null);

  const [showPayments, setShowPayments] = useState(false);
  const [showReturns, setShowReturns] = useState(false);
  const [showRefunds, setShowRefunds] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const [salesPage, setSalesPage] = useState(1);
  const [paymentsPage, setPaymentsPage] = useState(1);
  const [returnsPage, setReturnsPage] = useState(1);
  const [refundsPage, setRefundsPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingReturn, setSavingReturn] = useState(false);
  const [savingRefund, setSavingRefund] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState("");

  /* ---------------------------- lookups ---------------------------- */

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const customerMap = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers],
  );

  const saleMap = useMemo(
    () => new Map(sales.map((sale) => [sale.id, sale])),
    [sales],
  );

  const returnMap = useMemo(
    () => new Map(returns.map((saleReturn) => [saleReturn.id, saleReturn])),
    [returns],
  );

  function customerName(customerId: number | null) {
    if (!customerId) return "Walk-in Customer";

    const customer = customerMap.get(customerId);

    if (!customer) return `Customer #${customerId}`;

    return (
      customer.name ||
      customer.customer_name ||
      customer.phone ||
      `Customer #${customerId}`
    );
  }

  /* ----------------------- return calculations ---------------------- */

  function getSaleReturns(saleId: number) {
    return returns.filter(
      (saleReturn) =>
        saleReturn.sale === saleId && saleReturn.status !== "cancelled",
    );
  }

  function getReturnedQuantity(
    saleId: number,
    saleItemId: number,
    excludeReturnId?: number,
  ) {
    return getSaleReturns(saleId).reduce((total, saleReturn) => {
      if (excludeReturnId && saleReturn.id === excludeReturnId) {
        return total;
      }

      const item = saleReturn.items.find(
        (returnItem) => returnItem.sale_item === saleItemId,
      );

      return total + Number(item?.quantity || 0);
    }, 0);
  }

  function getAvailableReturnQuantity(
    sale: Sale,
    item: SaleItem,
    excludeReturnId?: number,
  ) {
    const soldQuantity = Number(item.quantity);
    const returnedQuantity = getReturnedQuantity(
      sale.id,
      item.id,
      excludeReturnId,
    );

    return Math.max(soldQuantity - returnedQuantity, 0);
  }

  function calculateReturnLineRefund(item: SaleItem, returnQuantity: number) {
    const soldQuantity = Number(item.quantity);

    if (soldQuantity <= 0 || returnQuantity <= 0) return 0;

    /* line_total includes discount and tax, so use its proportional share. */
    return Number(item.line_total || 0) * (returnQuantity / soldQuantity);
  }

  const returnSale = sales.find((item) => item.id === Number(returnForm.sale));

  function getReturnFormTotals() {
    if (!returnSale) return { tax: 0, total: 0 };

    let total = 0;
    let tax = 0;

    for (const formItem of returnForm.items) {
      const saleItem = returnSale.items.find(
        (item) => item.id === Number(formItem.sale_item),
      );

      if (!saleItem) continue;

      const quantity = Number(formItem.quantity || 0);

      if (quantity <= 0) continue;

      total += calculateReturnLineRefund(saleItem, quantity);

      const soldQuantity = Number(saleItem.quantity);
      const ratio = soldQuantity > 0 ? quantity / soldQuantity : 0;
      const gross = soldQuantity * Number(saleItem.unit_price);
      const discount = Number(saleItem.discount_amount || 0);
      const taxable = Math.max(gross - discount, 0);

      tax += taxable * (Number(saleItem.tax_rate || 0) / 100) * ratio;
    }

    /* The backend remains authoritative; this is an estimate. */
    return { tax, total };
  }

  function getReturnRefundAmount(saleReturn: SaleReturn) {
    const refund =
      saleReturn.refund ||
      refunds.find((item) => item.sale_return === saleReturn.id);

    let amount = Number(
      saleReturn.return_total ||
        saleReturn.refund_amount ||
        refund?.amount ||
        0,
    );

    if (amount === 0) {
      const sale = saleMap.get(saleReturn.sale);

      if (sale) {
        amount = saleReturn.items.reduce((total, item) => {
          const saleItem = sale.items.find(
            (entry) => entry.id === item.sale_item,
          );

          return (
            total +
            (saleItem
              ? calculateReturnLineRefund(saleItem, Number(item.quantity))
              : 0)
          );
        }, 0);
      }
    }

    return amount;
  }

  function getSaleRefunded(sale: Sale) {
    const fromRefunds = refunds
      .filter((refund) => refund.sale === sale.id)
      .reduce((total, refund) => total + Number(refund.amount || 0), 0);

    return Number(sale.refunded_amount || fromRefunds);
  }

  function getSaleNet(sale: Sale) {
    if (sale.net_total !== undefined) return Number(sale.net_total);

    return Math.max(Number(sale.total_amount) - getSaleRefunded(sale), 0);
  }

  function calculateFormTotals() {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;

    for (const item of saleForm.items) {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const itemDiscount = Number(item.discount_amount) || 0;
      const taxRate = Number(item.tax_rate) || 0;

      const gross = quantity * price;
      const taxable = Math.max(gross - itemDiscount, 0);

      subtotal += gross;
      discount += itemDiscount;
      tax += taxable * (taxRate / 100);
    }

    return {
      subtotal,
      tax,
      discount,
      total: subtotal - discount + tax,
    };
  }

  /* ----------------------------- loading ---------------------------- */

  const loadData = useCallback(async () => {
    if (!token) {
      setError("You are not authenticated. Please sign in again.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [
        meData,
        salesData,
        customersData,
        productsData,
        paymentsData,
        returnsData,
      ] = await Promise.all([
        apiFetch<MeResponse>("/api/accounts/me/", { token }).catch(() => null),
        apiFetch<Sale[]>("/api/sales/", { token }),
        apiFetch<Customer[]>("/api/customers/", { token }),
        apiFetch<Product[]>("/api/products/", { token }),
        apiFetch<SalePayment[]>("/api/sale-payments/", { token }),
        apiFetch<SaleReturn[]>("/api/sale-returns/", { token }),
      ]);

      if (meData) {
        if (typeof meData.can_view_totals === "boolean") {
          setCanViewTotals(meData.can_view_totals);
        } else {
          setCanViewTotals(
            meData.role === "admin" || meData.role === "manager",
          );
        }
      }

      setSales(Array.isArray(salesData) ? salesData : []);
      setCustomers(Array.isArray(customersData) ? customersData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      setReturns(Array.isArray(returnsData) ? returnsData : []);

      /* Refund history is optional on older backend versions. */
      try {
        const refundsData = await apiFetch<SaleRefund[]>(
          "/api/sale-refunds/",
          { token },
        );
        setRefunds(Array.isArray(refundsData) ? refundsData : []);
      } catch {
        setRefunds([]);
      }
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load sales data. Please retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* --------------------------- sale form ---------------------------- */

  function openCreateSale() {
    setEditingSaleId(null);
    setSaleForm({ ...emptySaleForm, items: [{ ...emptySaleItem }] });
    setShowSaleForm(true);
    setError("");
  }

  function openEditSale(sale: Sale) {
    if (sale.status !== "draft") {
      setError("Only draft sales can be edited.");
      return;
    }

    setEditingSaleId(sale.id);

    setSaleForm({
      sale_number: sale.sale_number,
      customer: sale.customer ? String(sale.customer) : "",
      payment_method: sale.payment_method,
      notes: sale.notes || "",
      items:
        sale.items.length > 0
          ? sale.items.map((item) => ({
              product: String(item.product),
              quantity: item.quantity,
              unit_price: item.unit_price,
              tax_rate: item.tax_rate,
              discount_amount: item.discount_amount,
            }))
          : [{ ...emptySaleItem }],
    });

    setShowSaleForm(true);
    setError("");
  }

  function closeSaleForm() {
    if (saving) return;
    setShowSaleForm(false);
    setEditingSaleId(null);
    setSaleForm({ ...emptySaleForm, items: [{ ...emptySaleItem }] });
  }

  function addSaleItem() {
    setSaleForm((current) => ({
      ...current,
      items: [...current.items, { ...emptySaleItem }],
    }));
  }

  function removeSaleItem(index: number) {
    setSaleForm((current) => {
      if (current.items.length === 1) return current;

      return {
        ...current,
        items: current.items.filter((_, itemIndex) => itemIndex !== index),
      };
    });
  }

  function updateSaleItem(
    index: number,
    field: keyof SaleFormItem,
    value: string,
  ) {
    setSaleForm((current) => {
      const updatedItems = [...current.items];

      updatedItems[index] = { ...updatedItems[index], [field]: value };

      if (field === "product" && value) {
        const product = productMap.get(Number(value));

        if (product) {
          updatedItems[index].unit_price = product.selling_price;
          updatedItems[index].tax_rate = product.tax_rate;
        }
      }

      return { ...current, items: updatedItems };
    });
  }

  async function handleSaleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (saleForm.items.length === 0) {
      setError("A sale must contain at least one item.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        customer: saleForm.customer ? Number(saleForm.customer) : null,
        payment_method: saleForm.payment_method,
        notes: saleForm.notes || "",
        items: saleForm.items.map((item) => ({
          product: Number(item.product),
          quantity: item.quantity,
          unit_price: item.unit_price,
          tax_rate: item.tax_rate,
          discount_amount: item.discount_amount || "0",
        })),
      };

      if (editingSaleId) {
        await apiFetch<Sale>(`/api/sales/${editingSaleId}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<Sale>("/api/sales/", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      }

      setShowSaleForm(false);
      setEditingSaleId(null);
      setSaleForm({ ...emptySaleForm, items: [{ ...emptySaleItem }] });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save sale.");
    } finally {
      setSaving(false);
    }
  }

  /* ------------------- confirm dialog (complete/delete/cancel) ------- */

  function requestCompleteSale(sale: Sale) {
    if (sale.status !== "draft") {
      setError("Only draft sales can be completed.");
      return;
    }

    if (sale.items.length === 0) {
      setError("A sale must contain at least one item.");
      return;
    }

    setError("");
    setConfirmTarget({ kind: "complete_sale", sale });
  }

  function requestDeleteSale(sale: Sale) {
    if (sale.status !== "draft") {
      setError("Only draft sales can be deleted.");
      return;
    }

    setError("");
    setConfirmTarget({ kind: "delete_sale", sale });
  }

  function requestCancelReturn(saleReturn: SaleReturn) {
    if (saleReturn.status !== "pending") {
      setError("Only pending returns can be cancelled.");
      return;
    }

    setError("");
    setConfirmTarget({ kind: "cancel_return", saleReturn });
  }

  async function handleConfirm() {
    if (!confirmTarget) return;

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    try {
      setConfirming(true);
      setError("");

      if (confirmTarget.kind === "complete_sale") {
        const responseData = await apiFetch<any>(
          `/api/sales/${confirmTarget.sale.id}/complete/`,
          {
            method: "POST",
            token,
            body: JSON.stringify({}),
          },
        );

        if (responseData && responseData.receipt) {
          setActiveReceiptData(responseData);
          setActiveReceiptInfo(responseData.receipt);
          setShowReceiptModal(true);
        }
      } else if (confirmTarget.kind === "delete_sale") {
        await apiFetch(`/api/sales/${confirmTarget.sale.id}/`, {
          method: "DELETE",
          token,
        });
      } else {
        await apiFetch<SaleReturn>(
          `/api/sale-returns/${confirmTarget.saleReturn.id}/cancel/`,
          {
            method: "POST",
            token,
            body: JSON.stringify({}),
          },
        );
      }

      setConfirmTarget(null);
      await loadData();
    } catch (err) {
      setConfirmTarget(null);
      setError(
        err instanceof Error ? err.message : "The action could not be completed.",
      );
    } finally {
      setConfirming(false);
    }
  }

  const confirmCopy = (() => {
    if (!confirmTarget) {
      return {
        title: "Are you sure?",
        description: "This action cannot be undone.",
        label: "Confirm",
        cancel: "Cancel",
        danger: false,
      };
    }

    if (confirmTarget.kind === "complete_sale") {
      return {
        title: "Complete sale?",
        description: `Complete sale ${confirmTarget.sale.sale_number}? Once completed, the sale cannot be edited.`,
        label: "Complete sale",
        cancel: "Not yet",
        danger: false,
      };
    }

    if (confirmTarget.kind === "delete_sale") {
      return {
        title: "Delete draft sale?",
        description: `Delete draft sale ${confirmTarget.sale.sale_number}? This action cannot be undone.`,
        label: "Delete sale",
        cancel: "Keep sale",
        danger: true,
      };
    }

    return {
      title: "Cancel return?",
      description: `Cancel return ${confirmTarget.saleReturn.return_number}?`,
      label: "Cancel return",
      cancel: "Keep return",
      danger: true,
    };
  })();

  /* --------------------------- payment form ------------------------- */

  function openPaymentForm(sale?: Sale) {
    const targetSale =
      sale ||
      sales.find(
        (item) =>
          item.status === "completed" && item.payment_status !== "paid",
      );

    setPaymentForm({
      ...emptyPaymentForm,
      sale: targetSale ? String(targetSale.id) : "",
      payment_method:
        targetSale?.payment_method === "credit"
          ? "cash"
          : targetSale?.payment_method || "cash",
      amount: targetSale
        ? Math.max(
            Number(targetSale.total_amount) - Number(targetSale.amount_paid),
            0,
          ).toFixed(2)
        : "",
    });

    setShowPaymentForm(true);
    setError("");
  }

  function closePaymentForm() {
    if (savingPayment) return;
    setShowPaymentForm(false);
    setPaymentForm({ ...emptyPaymentForm });
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    const sale = saleMap.get(Number(paymentForm.sale));

    if (!sale) {
      setError("Select a valid sale.");
      return;
    }

    if (sale.status !== "completed") {
      setError("Only completed sales can receive payments.");
      return;
    }

    if (sale.payment_status === "paid") {
      setError("This sale is already fully paid.");
      return;
    }

    try {
      setSavingPayment(true);
      setError("");

      await apiFetch<SalePayment>("/api/sale-payments/", {
        method: "POST",
        token,
        body: JSON.stringify({
          sale: Number(paymentForm.sale),
          amount: paymentForm.amount,
          payment_method: paymentForm.payment_method,
          reference: paymentForm.reference || "",
          notes: paymentForm.notes || "",
        }),
      });

      setShowPaymentForm(false);
      setPaymentForm({ ...emptyPaymentForm });
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record payment.",
      );
    } finally {
      setSavingPayment(false);
    }
  }

  /* --------------------------- return form -------------------------- */

  function openReturnForm(sale?: Sale, saleReturn?: SaleReturn) {
    const targetSale =
      sale || (saleReturn ? saleMap.get(saleReturn.sale) : undefined);

    if (!targetSale) {
      setEditingReturnId(null);
      setReturnForm({ ...emptyReturnForm, items: [] });
      setShowReturnForm(true);
      setError("");
      return;
    }

    if (targetSale.status !== "completed") {
      setError("Only completed sales can be returned.");
      return;
    }

    if (targetSale.payment_status !== "paid") {
      setError("A sale must be fully paid before a return can be created.");
      return;
    }

    const existingReturnItems = saleReturn?.items || [];

    setEditingReturnId(saleReturn?.id || null);

    setReturnForm({
      sale: String(targetSale.id),
      reason: saleReturn?.reason || "",
      items: targetSale.items.map((item) => {
        const existing = existingReturnItems.find(
          (returnItem) => returnItem.sale_item === item.id,
        );

        return {
          sale_item: String(item.id),
          quantity: existing?.quantity || "0",
        };
      }),
    });

    setShowReturnForm(true);
    setError("");
  }

  function closeReturnForm() {
    if (savingReturn) return;
    setShowReturnForm(false);
    setEditingReturnId(null);
    setReturnForm({ ...emptyReturnForm, items: [] });
  }

  function handleReturnSaleChange(saleId: string) {
    const sale = sales.find((item) => item.id === Number(saleId));

    setEditingReturnId(null);

    setReturnForm({
      sale: saleId,
      reason: "",
      items: sale
        ? sale.items.map((item) => ({
            sale_item: String(item.id),
            quantity: "0",
          }))
        : [],
    });
  }

  function updateReturnQuantity(saleItemId: string, quantity: string) {
    if (!returnSale) return;

    const saleItem = returnSale.items.find(
      (item) => item.id === Number(saleItemId),
    );

    if (!saleItem) return;

    const available = getAvailableReturnQuantity(
      returnSale,
      saleItem,
      editingReturnId || undefined,
    );

    if (quantity !== "" && Number(quantity) > available) {
      quantity = available.toString();
    }

    setReturnForm((current) => ({
      ...current,
      items: current.items.map((item) =>
        item.sale_item === saleItemId ? { ...item, quantity } : item,
      ),
    }));
  }

  async function handleReturnSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    const sale = saleMap.get(Number(returnForm.sale));

    if (!sale) {
      setError("Select a valid sale.");
      return;
    }

    if (sale.status !== "completed") {
      setError("Only completed sales can be returned.");
      return;
    }

    if (sale.payment_status !== "paid") {
      setError("The sale must be fully paid before creating a return.");
      return;
    }

    const selectedItems = returnForm.items.filter(
      (item) => Number(item.quantity) > 0,
    );

    if (selectedItems.length === 0) {
      setError("Select at least one item quantity to return.");
      return;
    }

    for (const item of selectedItems) {
      const saleItem = sale.items.find(
        (entry) => entry.id === Number(item.sale_item),
      );

      if (!saleItem) {
        setError("One of the selected sale items is invalid.");
        return;
      }

      const available = getAvailableReturnQuantity(
        sale,
        saleItem,
        editingReturnId || undefined,
      );

      if (Number(item.quantity) > available) {
        setError(
          `${productMap.get(saleItem.product)?.name || "Item"} has only ${available} available for return.`,
        );
        return;
      }
    }

    try {
      setSavingReturn(true);
      setError("");

      const payload = {
        sale: sale.id,
        reason: returnForm.reason,
        items: selectedItems.map((item) => ({
          sale_item: Number(item.sale_item),
          quantity: item.quantity,
        })),
      };

      if (editingReturnId) {
        await apiFetch<SaleReturn>(`/api/sale-returns/${editingReturnId}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<SaleReturn>("/api/sale-returns/", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      }

      setShowReturnForm(false);
      setEditingReturnId(null);
      setReturnForm({ ...emptyReturnForm, items: [] });
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save return.");
    } finally {
      setSavingReturn(false);
    }
  }

  /* --------------------------- refund form -------------------------- */

  function openRefundForm(saleReturn: SaleReturn) {
    if (saleReturn.status !== "pending") {
      setError("Only pending returns can be completed.");
      return;
    }

    const sale = saleMap.get(saleReturn.sale);

    if (!sale) {
      setError("The sale connected to this return could not be found.");
      return;
    }

    if (sale.payment_status !== "paid") {
      setError(
        "The sale must be fully paid before the customer can be refunded.",
      );
      return;
    }

    setRefundForm({
      returnId: saleReturn.id,
      refundMethod:
        sale.payment_method === "credit" ? "cash" : sale.payment_method,
      reference: "",
    });

    setShowRefundForm(true);
    setError("");
  }

  function closeRefundForm() {
    if (savingRefund) return;
    setShowRefundForm(false);
    setRefundForm({ ...emptyRefundForm });
  }

  async function handleRefundSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (!refundForm.returnId) {
      setError("No return selected.");
      return;
    }

    const saleReturn = returnMap.get(refundForm.returnId);

    if (!saleReturn) {
      setError("Return could not be found.");
      return;
    }

    if (saleReturn.status !== "pending") {
      setError("Only pending returns can be completed.");
      return;
    }

    try {
      setSavingRefund(true);
      setError("");

      await apiFetch<SaleReturn>(
        `/api/sale-returns/${saleReturn.id}/complete/`,
        {
          method: "POST",
          token,
          body: JSON.stringify({
            refund_method: refundForm.refundMethod,
            refund_reference: refundForm.reference || "",
          }),
        },
      );

      setShowRefundForm(false);
      setRefundForm({ ...emptyRefundForm });
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to complete refund.",
      );
    } finally {
      setSavingRefund(false);
    }
  }

  /* ----------------------------- derived ---------------------------- */

  const filteredSales = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return sales.filter((sale) => {
      const matchesSearch =
        !searchText ||
        sale.sale_number.toLowerCase().includes(searchText) ||
        customerName(sale.customer).toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "all" || sale.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" || sale.payment_status === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sales, search, statusFilter, paymentFilter, customerMap]);

  useEffect(() => {
    setSalesPage(1);
  }, [search, statusFilter, paymentFilter]);

  const totalSalesPages = Math.max(
    1,
    Math.ceil(filteredSales.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (salesPage > totalSalesPages) setSalesPage(totalSalesPages);
  }, [salesPage, totalSalesPages]);

  const paginatedSales = useMemo(() => {
    const start = (salesPage - 1) * DEFAULT_PAGE_SIZE;
    return filteredSales.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredSales, salesPage]);

  const sortedPayments = useMemo(
    () =>
      [...payments].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [payments],
  );

  const totalPaymentsPages = Math.max(
    1,
    Math.ceil(sortedPayments.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (paymentsPage > totalPaymentsPages) setPaymentsPage(totalPaymentsPages);
  }, [paymentsPage, totalPaymentsPages]);

  const paginatedPayments = useMemo(() => {
    const start = (paymentsPage - 1) * DEFAULT_PAGE_SIZE;
    return sortedPayments.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [sortedPayments, paymentsPage]);

  const sortedReturns = useMemo(
    () =>
      [...returns].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [returns],
  );

  const totalReturnsPages = Math.max(
    1,
    Math.ceil(sortedReturns.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (returnsPage > totalReturnsPages) setReturnsPage(totalReturnsPages);
  }, [returnsPage, totalReturnsPages]);

  const paginatedReturns = useMemo(() => {
    const start = (returnsPage - 1) * DEFAULT_PAGE_SIZE;
    return sortedReturns.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [sortedReturns, returnsPage]);

  const sortedRefunds = useMemo(
    () =>
      [...refunds].sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      ),
    [refunds],
  );

  const totalRefundsPages = Math.max(
    1,
    Math.ceil(sortedRefunds.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (refundsPage > totalRefundsPages) setRefundsPage(totalRefundsPages);
  }, [refundsPage, totalRefundsPages]);

  const paginatedRefunds = useMemo(() => {
    const start = (refundsPage - 1) * DEFAULT_PAGE_SIZE;
    return sortedRefunds.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [sortedRefunds, refundsPage]);

  const totalSales = sales.reduce(
    (sum, sale) => sum + Number(sale.total_amount || 0),
    0,
  );

  const totalRefunded = refunds.reduce(
    (sum, refund) => sum + Number(refund.amount || 0),
    0,
  );

  const totalNetSales = sales.reduce((sum, sale) => sum + getSaleNet(sale), 0);

  const draftCount = sales.filter((sale) => sale.status === "draft").length;

  const unpaidCount = sales.filter(
    (sale) => sale.payment_status === "unpaid",
  ).length;

  const pendingReturns = returns.filter(
    (saleReturn) => saleReturn.status === "pending",
  ).length;

  const formTotals = calculateFormTotals();
  const returnFormTotals = getReturnFormTotals();

  const payableSales = sales.filter(
    (sale) => sale.status === "completed" && sale.payment_status !== "paid",
  );

  const returnableSales = sales.filter(
    (sale) => sale.status === "completed" && sale.payment_status === "paid",
  );

  const refundReturn = refundForm.returnId
    ? returnMap.get(refundForm.returnId)
    : undefined;

  const refundSale = refundReturn ? saleMap.get(refundReturn.sale) : undefined;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setSalesPage(1);
  }

  /* ----------------------------- columns ---------------------------- */

  const saleColumns: Column<Sale>[] = [
    {
      key: "sale_number",
      label: "Sale",
      render: (sale) => (
        <div className="min-w-0">
          <p className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
            {sale.sale_number}
          </p>
          <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
            {formatDate(sale.sale_date)}
          </p>
        </div>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (sale) => (
        <span className="break-words text-[var(--charcoal-700)]">
          {customerName(sale.customer)}
        </span>
      ),
    },
    {
      key: "items",
      label: "Items",
      hideBelow: "md",
      render: (sale) => (
        <span className="tabular-nums">{sale.items.length}</span>
      ),
    },
    {
      key: "total_amount",
      label: "Original",
      hideBelow: "lg",
      render: (sale) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {money(sale.total_amount)}
        </span>
      ),
    },
    {
      key: "refunded_amount",
      label: "Refunded",
      hideBelow: "lg",
      render: (sale) => {
        const refunded = getSaleRefunded(sale);

        return (
          <span className="whitespace-nowrap tabular-nums text-[var(--charcoal-700)]">
            {refunded > 0 ? money(refunded) : "—"}
          </span>
        );
      },
    },
    {
      key: "net_total",
      label: "Net",
      align: "right",
      render: (sale) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {money(getSaleNet(sale))}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (sale) => {
        const hasCompletedReturn = getSaleReturns(sale.id).some(
          (saleReturn) => saleReturn.status === "completed",
        );

        return (
          <div className="min-w-0">
            <StatusBadge status={sale.status} />
            {hasCompletedReturn && (
              <p className="mt-1.5 text-xs text-[var(--charcoal-500)]">
                Return recorded
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "payment_status",
      label: "Payment",
      hideBelow: "sm",
      render: (sale) => <StatusBadge status={sale.payment_status} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (sale) => {
        const fullyPaid = sale.payment_status === "paid";
        const hasCompletedReturn = getSaleReturns(sale.id).some(
          (saleReturn) => saleReturn.status === "completed",
        );

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {sale.status === "draft" && (
              <>
                <Button size="sm" onClick={() => requestCompleteSale(sale)}>
                  Complete
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditSale(sale)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => requestDeleteSale(sale)}
                >
                  <span className="text-red-700">Delete</span>
                </Button>
              </>
            )}

            {sale.status === "completed" && !fullyPaid && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => openPaymentForm(sale)}
              >
                Record payment
              </Button>
            )}

            {sale.status === "completed" && fullyPaid && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openReturnForm(sale)}
                >
                  Return
                </Button>
                <span className="text-xs font-medium text-[var(--charcoal-500)]">
                  {hasCompletedReturn ? "Sale locked" : "Paid & locked"}
                </span>
              </>
            )}

            {sale.status === "returned" && (
              <span className="text-xs font-medium text-[var(--charcoal-500)]">
                Fully returned
              </span>
            )}
          </div>
        );
      },
    },
  ];

  const paymentColumns: Column<SalePayment>[] = [
    {
      key: "created_at",
      label: "Date",
      hideBelow: "sm",
      render: (payment) => (
        <span className="whitespace-nowrap text-xs text-[var(--charcoal-600)]">
          {formatDate(payment.created_at)}
        </span>
      ),
    },
    {
      key: "sale",
      label: "Sale",
      render: (payment) => (
        <span className="break-all font-mono text-sm font-medium text-[var(--charcoal-900)]">
          {saleMap.get(payment.sale)?.sale_number || `Sale #${payment.sale}`}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (payment) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {money(payment.amount)}
        </span>
      ),
    },
    {
      key: "payment_method",
      label: "Method",
      render: (payment) => (
        <span className="capitalize text-[var(--charcoal-700)]">
          {formatStatus(payment.payment_method)}
        </span>
      ),
    },
    {
      key: "reference",
      label: "Reference",
      hideBelow: "md",
      render: (payment) => (
        <span className="break-words">{payment.reference || "—"}</span>
      ),
    },
  ];

  const returnColumns: Column<SaleReturn>[] = [
    {
      key: "return_number",
      label: "Return",
      render: (saleReturn) => (
        <span className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
          {saleReturn.return_number}
        </span>
      ),
    },
    {
      key: "sale",
      label: "Sale",
      render: (saleReturn) => (
        <span className="break-all font-mono text-sm text-[var(--charcoal-700)]">
          {saleMap.get(saleReturn.sale)?.sale_number ||
            `Sale #${saleReturn.sale}`}
        </span>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      hideBelow: "md",
      render: (saleReturn) => (
        <span className="block break-words text-[var(--charcoal-600)]">
          {saleReturn.reason || "—"}
        </span>
      ),
    },
    {
      key: "items",
      label: "Items",
      hideBelow: "lg",
      render: (saleReturn) => (
        <span className="tabular-nums">{saleReturn.items.length}</span>
      ),
    },
    {
      key: "refund_amount",
      label: "Refund",
      align: "right",
      render: (saleReturn) => {
        const amount = getReturnRefundAmount(saleReturn);

        return (
          <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
            {amount > 0 ? money(amount) : "Pending"}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (saleReturn) => <StatusBadge status={saleReturn.status} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (saleReturn) => {
        if (saleReturn.status === "pending") {
          return (
            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" onClick={() => openRefundForm(saleReturn)}>
                Complete &amp; refund
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openReturnForm(undefined, saleReturn)}
              >
                Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => requestCancelReturn(saleReturn)}
              >
                <span className="text-red-700">Cancel</span>
              </Button>
            </div>
          );
        }

        return (
          <span className="text-xs font-medium text-[var(--charcoal-500)]">
            {saleReturn.status === "completed" ? "Locked" : "Cancelled"}
          </span>
        );
      },
    },
  ];

  const refundColumns: Column<SaleRefund>[] = [
    {
      key: "refund_number",
      label: "Refund",
      render: (refund) => (
        <span className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
          {refund.refund_number}
        </span>
      ),
    },
    {
      key: "sale",
      label: "Sale",
      render: (refund) => (
        <span className="break-all font-mono text-sm text-[var(--charcoal-700)]">
          {saleMap.get(refund.sale)?.sale_number || `Sale #${refund.sale}`}
        </span>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      align: "right",
      render: (refund) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {money(refund.amount)}
        </span>
      ),
    },
    {
      key: "refund_method",
      label: "Method",
      hideBelow: "sm",
      render: (refund) => (
        <span className="capitalize text-[var(--charcoal-700)]">
          {formatStatus(refund.refund_method)}
        </span>
      ),
    },
    {
      key: "reference",
      label: "Reference",
      hideBelow: "md",
      render: (refund) => (
        <span className="break-words">{refund.reference || "—"}</span>
      ),
    },
    {
      key: "created_at",
      label: "Date",
      hideBelow: "lg",
      render: (refund) => (
        <span className="whitespace-nowrap text-xs text-[var(--charcoal-600)]">
          {formatDate(refund.created_at)}
        </span>
      ),
    },
  ];

  /* ------------------------------ render ---------------------------- */

  const anyModalOpen =
    showSaleForm || showPaymentForm || showReturnForm || showRefundForm;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Sales"
        subtitle="Manage sales, payments, returns and customer refunds."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Sales" },
        ]}
        action={<Button onClick={openCreateSale}>+ New sale</Button>}
      />

      {error && !anyModalOpen && (
        <ErrorState
          title="Sales operation failed"
          message={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void loadData()}>
              Retry loading
            </Button>
          }
        />
      )}

      {canViewTotals && (
        <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
          <StatCard
            label="Sales"
            value={sales.length.toLocaleString()}
            hint="All recorded sales"
            tone="default"
          />
          <StatCard
            label="Original value"
            value={money(totalSales)}
            hint="Before refunds"
            tone="default"
          />
          <StatCard
            label="Net value"
            value={money(totalNetSales)}
            hint="After refunds"
            tone="default"
          />
          <StatCard
            label="Refunded"
            value={money(totalRefunded)}
            hint="Completed refunds"
            tone={totalRefunded > 0 ? "warning" : "default"}
          />
          <StatCard
            label="Draft / unpaid"
            value={`${draftCount} / ${unpaidCount}`}
            hint="Sales needing attention"
            tone={unpaidCount > 0 ? "warning" : "default"}
          />
        </div>
      )}

      {/* SALES RECORDS */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Sales records
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Search sales and track payment and return progress.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showPayments ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowPayments((visible) => !visible)}
            >
              {showPayments ? "Hide payments" : "Payments"}
            </Button>
            <Button
              variant={showReturns ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowReturns((visible) => !visible)}
            >
              {showReturns
                ? "Hide returns"
                : `Returns${pendingReturns > 0 ? ` (${pendingReturns})` : ""}`}
            </Button>
            <Button
              variant={showRefunds ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowRefunds((visible) => !visible)}
            >
              {showRefunds ? "Hide refunds" : "Refunds"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadData()}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 md:grid-cols-[minmax(220px,1fr)_170px_170px_auto]">
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Search sale number or customer..."
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={saleStatusOptions}
            aria-label="Filter sale status"
          />

          <Select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            options={paymentStatusOptions}
            aria-label="Filter payment status"
          />

          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-[var(--charcoal-500)]">
            Showing{" "}
            <span className="font-semibold text-[var(--charcoal-800)]">
              {filteredSales.length}
            </span>{" "}
            of {sales.length} sales
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingState rows={5} />
          </div>
        ) : filteredSales.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title={sales.length === 0 ? "No sales yet" : "No matching sales"}
              hint={
                sales.length === 0
                  ? "Create a sale to start recording revenue."
                  : "Try a different search term or clear your filters."
              }
              action={
                sales.length === 0 ? (
                  <Button onClick={openCreateSale}>+ New sale</Button>
                ) : (
                  <Button variant="outline" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )
              }
            />
          </div>
        ) : (
          <>
            <DataTable
              columns={saleColumns}
              rows={paginatedSales}
              rowKey={(sale) => sale.id}
              emptyMessage="No sales found."
            />
            <Pagination
              page={salesPage}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredSales.length}
              onPageChange={setSalesPage}
            />
          </>
        )}
      </section>

      {/* PAYMENTS */}
      {showPayments && (
        <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-[var(--charcoal-900)]">
                Payment history
              </h2>
              <p className="mt-1 text-sm text-[var(--charcoal-500)]">
                Payments are immutable financial records.
              </p>
            </div>
            {payableSales.length > 0 && (
              <Button size="sm" onClick={() => openPaymentForm()}>
                + Record payment
              </Button>
            )}
          </div>

          {payments.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState
                title="No payments"
                hint="Recorded payments will appear here."
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={paymentColumns}
                rows={paginatedPayments}
                rowKey={(payment) => payment.id}
                emptyMessage="No payments found."
              />
              <Pagination
                page={paymentsPage}
                pageSize={DEFAULT_PAGE_SIZE}
                totalItems={sortedPayments.length}
                onPageChange={setPaymentsPage}
              />
            </>
          )}
        </section>
      )}

      {/* RETURNS */}
      {showReturns && (
        <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
          <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="font-semibold text-[var(--charcoal-900)]">
                Sale returns
              </h2>
              <p className="mt-1 text-sm text-[var(--charcoal-500)]">
                Pending returns can be edited or cancelled. Completed returns
                are permanently locked.
              </p>
            </div>
            <Button size="sm" onClick={() => openReturnForm()}>
              + New return
            </Button>
          </div>

          {returns.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState
                title="No returns"
                hint="Customer returns will appear here."
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={returnColumns}
                rows={paginatedReturns}
                rowKey={(saleReturn) => saleReturn.id}
                emptyMessage="No returns found."
              />
              <Pagination
                page={returnsPage}
                pageSize={DEFAULT_PAGE_SIZE}
                totalItems={sortedReturns.length}
                onPageChange={setReturnsPage}
              />
            </>
          )}
        </section>
      )}

      {/* REFUNDS */}
      {showRefunds && (
        <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border-soft)] p-4">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Refund history
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Refund transactions created from completed customer returns.
            </p>
          </div>

          {refunds.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState
                title="No refunds"
                hint="Completed refunds will appear here."
              />
            </div>
          ) : (
            <>
              <DataTable
                columns={refundColumns}
                rows={paginatedRefunds}
                rowKey={(refund) => refund.id}
                emptyMessage="No refunds found."
              />
              <Pagination
                page={refundsPage}
                pageSize={DEFAULT_PAGE_SIZE}
                totalItems={sortedRefunds.length}
                onPageChange={setRefundsPage}
              />
            </>
          )}
        </section>
      )}

      {/* SALE MODAL */}
      <Modal
        open={showSaleForm}
        onClose={closeSaleForm}
        title={editingSaleId ? "Edit draft sale" : "New sale"}
        description="Completed sales are locked and can only be changed through returns."
        size="lg"
      >
        <form onSubmit={handleSaleSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Sale number">
              <Input
                value={saleForm.sale_number}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    sale_number: event.target.value,
                  }))
                }
                placeholder="Optional"
              />
            </FormField>

            <FormField label="Customer">
              <select
                value={saleForm.customer}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    customer: event.target.value,
                  }))
                }
                className={fieldClass}
              >
                <option value="">Walk-in Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customerName(customer.id)}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Payment method" required>
            <Select
              value={saleForm.payment_method}
              onChange={(event) =>
                setSaleForm((current) => ({
                  ...current,
                  payment_method: event.target.value,
                }))
              }
              options={saleMethodOptions}
              required
            />
          </FormField>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
                Sale items
              </h3>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addSaleItem}
              >
                + Add item
              </Button>
            </div>

            {saleForm.items.map((item, index) => (
              <div
                key={index}
                className="min-w-0 space-y-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3"
              >
                <FormField label="Product" required>
                  <select
                    value={item.product}
                    onChange={(event) =>
                      updateSaleItem(index, "product", event.target.value)
                    }
                    required
                    className={fieldClass}
                  >
                    <option value="">Select product</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} — {product.sku}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-4">
                  <FormField label="Qty" required>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) =>
                        updateSaleItem(index, "quantity", event.target.value)
                      }
                      required
                    />
                  </FormField>

                  <FormField label="Unit price" required>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_price}
                      onChange={(event) =>
                        updateSaleItem(index, "unit_price", event.target.value)
                      }
                      required
                    />
                  </FormField>

                  <FormField label="Tax %">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={item.tax_rate}
                      onChange={(event) =>
                        updateSaleItem(index, "tax_rate", event.target.value)
                      }
                    />
                  </FormField>

                  <FormField label="Discount">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.discount_amount}
                      onChange={(event) =>
                        updateSaleItem(
                          index,
                          "discount_amount",
                          event.target.value,
                        )
                      }
                    />
                  </FormField>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => removeSaleItem(index)}
                    disabled={saleForm.items.length === 1}
                  >
                    <span className="text-red-700">Remove</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Notes">
              <textarea
                value={saleForm.notes}
                onChange={(event) =>
                  setSaleForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                rows={4}
                className={fieldClass}
                placeholder="Optional sale notes..."
              />
            </FormField>

            <div className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
              <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
                Estimated totals
              </h3>
              <div className="mt-3 space-y-2">
                <SummaryRow
                  label="Subtotal"
                  value={money(formTotals.subtotal)}
                />
                <SummaryRow
                  label="Discount"
                  value={money(formTotals.discount)}
                />
                <SummaryRow label="Tax" value={money(formTotals.tax)} />
                <div className="border-t border-[var(--border-soft)] pt-2">
                  <SummaryRow
                    label="Total"
                    value={money(formTotals.total)}
                    strong
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeSaleForm}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={!products.length}>
              {editingSaleId ? "Update draft" : "Create sale"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal
        open={showPaymentForm}
        onClose={closePaymentForm}
        title="Record payment"
        description="Payments become permanent once recorded."
        size="lg"
      >
        <form onSubmit={handlePaymentSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          <FormField label="Sale" required>
            <select
              value={paymentForm.sale}
              onChange={(event) => {
                const sale = saleMap.get(Number(event.target.value));

                setPaymentForm((current) => ({
                  ...current,
                  sale: event.target.value,
                  amount: sale
                    ? Math.max(
                        Number(sale.total_amount) - Number(sale.amount_paid),
                        0,
                      ).toFixed(2)
                    : "",
                }));
              }}
              required
              className={fieldClass}
            >
              <option value="">Select sale</option>
              {payableSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.sale_number} — {money(sale.total_amount)}
                </option>
              ))}
            </select>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount" required>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={paymentForm.amount}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    amount: event.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Payment method" required>
              <Select
                value={paymentForm.payment_method}
                onChange={(event) =>
                  setPaymentForm((current) => ({
                    ...current,
                    payment_method: event.target.value,
                  }))
                }
                options={paymentMethodOptions}
                required
              />
            </FormField>
          </div>

          <FormField label="Reference">
            <Input
              value={paymentForm.reference}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  reference: event.target.value,
                }))
              }
              placeholder="Optional reference"
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              value={paymentForm.notes}
              onChange={(event) =>
                setPaymentForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              rows={3}
              className={fieldClass}
              placeholder="Add any relevant details..."
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closePaymentForm}
              disabled={savingPayment}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingPayment}>
              Record payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* RETURN MODAL */}
      <Modal
        open={showReturnForm}
        onClose={closeReturnForm}
        title={editingReturnId ? "Edit pending return" : "Create sale return"}
        description="Only the remaining unreturned quantity can be selected."
        size="lg"
      >
        <form onSubmit={handleReturnSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          <FormField label="Sale" required>
            <select
              value={returnForm.sale}
              onChange={(event) => handleReturnSaleChange(event.target.value)}
              required
              disabled={editingReturnId !== null}
              className={fieldClass}
            >
              <option value="">Select sale</option>
              {returnableSales.map((sale) => (
                <option key={sale.id} value={sale.id}>
                  {sale.sale_number} — {customerName(sale.customer)}
                </option>
              ))}
            </select>
            {returnableSales.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-700">
                No fully paid, completed sales are available for return.
              </p>
            )}
          </FormField>

          <FormField label="Reason" required>
            <Input
              value={returnForm.reason}
              onChange={(event) =>
                setReturnForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              required
              placeholder="Why is the customer returning the item?"
            />
          </FormField>

          {returnSale && (
            <div className="min-w-0 space-y-3">
              <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
                Items to return
              </h3>

              {returnSale.items.map((item) => {
                const product = productMap.get(item.product);

                const alreadyReturned = getReturnedQuantity(
                  returnSale.id,
                  item.id,
                  editingReturnId || undefined,
                );

                const available = getAvailableReturnQuantity(
                  returnSale,
                  item,
                  editingReturnId || undefined,
                );

                const current = returnForm.items.find(
                  (returnItem) => returnItem.sale_item === String(item.id),
                );

                const refund = calculateReturnLineRefund(
                  item,
                  Number(current?.quantity || 0),
                );

                return (
                  <div
                    key={item.id}
                    className="flex flex-col gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0">
                      <p className="break-words font-semibold text-[var(--charcoal-900)]">
                        {product?.name || `Product #${item.product}`}
                      </p>
                      {product?.sku && (
                        <p className="mt-0.5 break-all font-mono text-xs text-[var(--charcoal-500)]">
                          {product.sku}
                        </p>
                      )}
                      <p className="mt-1.5 text-xs text-[var(--charcoal-500)]">
                        Sold {item.quantity} · Returned {alreadyReturned} ·{" "}
                        <span
                          className={
                            available > 0
                              ? "font-semibold text-[var(--charcoal-800)]"
                              : "font-semibold text-red-700"
                          }
                        >
                          Available {available}
                        </span>{" "}
                        · Est. refund {money(refund)}
                      </p>
                    </div>

                    <div className="w-full shrink-0 sm:w-28">
                      <Input
                        type="number"
                        min="0"
                        max={available}
                        step="0.01"
                        value={current?.quantity || "0"}
                        disabled={available <= 0}
                        onChange={(event) =>
                          updateReturnQuantity(
                            String(item.id),
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}

              <div className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
                <div className="space-y-2">
                  <SummaryRow
                    label="Estimated tax reversal"
                    value={money(returnFormTotals.tax)}
                  />
                  <SummaryRow
                    label="Estimated refund"
                    value={money(returnFormTotals.total)}
                    strong
                  />
                </div>
                <p className="mt-3 text-xs text-[var(--charcoal-500)]">
                  Final refund and tax values are calculated by BuildOps when
                  the return is completed.
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeReturnForm}
              disabled={savingReturn}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingReturn}>
              {editingReturnId ? "Update pending return" : "Create pending return"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* REFUND MODAL */}
      <Modal
        open={showRefundForm}
        onClose={closeRefundForm}
        title="Complete customer refund"
        description="Completing the return restores stock and records the refund permanently."
        size="lg"
      >
        <form onSubmit={handleRefundSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          {refundReturn && (
            <div className="grid grid-cols-1 gap-4 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 sm:grid-cols-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--charcoal-500)]">
                  Return
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
                  {refundReturn.return_number}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--charcoal-500)]">
                  Sale
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
                  {refundSale?.sale_number || `Sale #${refundReturn.sale}`}
                </p>
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--charcoal-500)]">
                  Estimated refund
                </p>
                <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[var(--charcoal-900)]">
                  {money(getReturnRefundAmount(refundReturn))}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Refund method" required>
              <Select
                value={refundForm.refundMethod}
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    refundMethod: event.target.value,
                  }))
                }
                options={paymentMethodOptions}
                required
              />
            </FormField>

            <FormField label="Refund reference">
              <Input
                value={refundForm.reference}
                onChange={(event) =>
                  setRefundForm((current) => ({
                    ...current,
                    reference: event.target.value,
                  }))
                }
                placeholder="M-Pesa / bank / card reference"
              />
            </FormField>
          </div>

          <div className="break-words rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            This action is permanent. BuildOps will restore the returned stock,
            record the refund and lock the completed return.
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeRefundForm}
              disabled={savingRefund}
            >
              Cancel
            </Button>
            <Button type="submit" loading={savingRefund}>
              Complete return &amp; record refund
            </Button>
          </div>
        </form>
      </Modal>

      {/* RECEIPT MODAL */}
      {showReceiptModal && (
        <ReceiptModal
          saleData={activeReceiptData}
          receiptInfo={activeReceiptInfo}
          onClose={() => {
            setShowReceiptModal(false);
            setActiveReceiptData(null);
            setActiveReceiptInfo(null);
          }}
          onPrintSuccess={() => {
            console.log("Thermal print sequence dispatched successfully.");
          }}
        />
      )}

      {/* CONFIRM DIALOG */}
      <ConfirmDialog
        open={confirmTarget !== null}
        onClose={() => {
          if (!confirming) setConfirmTarget(null);
        }}
        onConfirm={() => void handleConfirm()}
        title={confirmCopy.title}
        description={confirmCopy.description}
        confirmLabel={confirmCopy.label}
        cancelLabel={confirmCopy.cancel}
        danger={confirmCopy.danger}
        loading={confirming}
      />
    </div>
  );
}