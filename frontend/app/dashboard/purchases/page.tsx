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
  Drawer,
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
  Toast,
} from "@/components";
import type { Column } from "@/components";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/Pagination";

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type Supplier = {
  id: number;
  name: string;
};

type Product = {
  id: number;
  sku: string;
  name: string;
  cost_price: string | number;
  tax_rate: string | number;
};

type PurchaseStatus =
  | "draft"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

type PaymentStatus = "unpaid" | "partially_paid" | "paid";

type PaymentMethod = "cash" | "mpesa" | "card" | "bank_transfer";

type PurchaseItem = {
  id?: number;
  product: number;
  quantity: string | number;
  unit_cost: string | number;
  tax_rate: string | number;
  discount_amount: string | number;
  line_total?: string | number;
  received_quantity?: string | number;
};

type PurchasePayment = {
  id: number;
  purchase: number;
  amount: string | number;
  payment_method: PaymentMethod;
  reference: string;
  notes: string;
  paid_by?: number;
  created_at: string;
};

type Purchase = {
  id: number;
  purchase_number: string;
  supplier: number;
  purchase_date: string;
  expected_delivery_date: string | null;
  status: PurchaseStatus;
  payment_status: PaymentStatus;
  subtotal: string | number;
  tax_amount: string | number;
  discount_amount: string | number;
  total_amount: string | number;
  notes: string;
  created_by?: number;
  created_at: string;
  updated_at: string;
  items: PurchaseItem[];
  payments: PurchasePayment[];
};

type PurchaseItemForm = {
  product: string;
  quantity: string;
  unit_cost: string;
  tax_rate: string;
  discount_amount: string;
};

type ReceiveItemForm = {
  purchaseItemId: number;
  productName: string;
  orderedQuantity: number;
  alreadyReceivedQuantity: number;
  remainingQuantity: number;
  receiveQuantity: string;
};

type ConfirmTarget = {
  kind: "order" | "cancel" | "delete";
  purchase: Purchase;
} | null;

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
];

const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "ordered", label: "Ordered" },
  { value: "partially_received", label: "Partially received" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
];

const paymentFilterOptions = [
  { value: "all", label: "All payments" },
  { value: "unpaid", label: "Unpaid" },
  { value: "partially_paid", label: "Partially paid" },
  { value: "paid", label: "Paid" },
];

const fieldClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:min-h-0 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

function money(value: string | number | null | undefined) {
  return Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function ksh(value: string | number | null | undefined) {
  return `KSh ${money(value)}`;
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "";

  /* Dates can arrive as ISO datetimes; the date part avoids timezone shifts. */
  return value.slice(0, 10);
}

function displayDate(value: string | null | undefined) {
  if (!value) return "—";

  const parts = value.slice(0, 10).split("-");

  if (parts.length !== 3) return value;

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function today() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function emptyItem(): PurchaseItemForm {
  return {
    product: "",
    quantity: "1",
    unit_cost: "",
    tax_rate: "0",
    discount_amount: "0",
  };
}

function unwrap<T>(data: { results?: T[] } | T[]): T[] {
  return Array.isArray(data) ? data : data.results || [];
}

function paidAmount(purchase: Purchase) {
  return purchase.payments.reduce(
    (sum, payment) => sum + Number(payment.amount || 0),
    0,
  );
}

function outstandingAmount(purchase: Purchase) {
  return Math.max(Number(purchase.total_amount || 0) - paidAmount(purchase), 0);
}

function paymentMethodLabel(method: PaymentMethod) {
  return (
    PAYMENT_METHOD_OPTIONS.find((item) => item.value === method)?.label ||
    method
  );
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

function ModalError({ message }: { message: string }) {
  if (!message) return null;

  return (
    <p className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
      {message}
    </p>
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

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
      <p className="text-xs font-medium text-[var(--charcoal-500)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[var(--charcoal-900)]">
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function PurchasesPage() {
  const token = getToken();

  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(
    null,
  );

  const [supplierId, setSupplierId] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(today());
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<PurchaseItemForm[]>([emptyItem()]);

  const [receivePurchaseData, setReceivePurchaseData] =
    useState<Purchase | null>(null);
  const [receiveItems, setReceiveItems] = useState<ReceiveItemForm[]>([]);
  const [receiveNotes, setReceiveNotes] = useState("");

  const [paymentPurchase, setPaymentPurchase] = useState<Purchase | null>(
    null,
  );
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  const [viewPurchaseId, setViewPurchaseId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  /* ----------------------------- toast ------------------------------ */

  function notify(message: string) {
    setSuccessMessage(message);
  }

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => setSuccessMessage(""), 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  /* ----------------------------- loading ---------------------------- */

  const loadData = useCallback(async () => {
    if (!token) {
      setError("You are not authenticated. Please sign in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [purchaseData, supplierData, productData] = await Promise.all([
        apiFetch<{ results?: Purchase[] } | Purchase[]>("/api/purchases/", {
          token,
        }),
        apiFetch<{ results?: Supplier[] } | Supplier[]>("/api/suppliers/", {
          token,
        }),
        apiFetch<{ results?: Product[] } | Product[]>("/api/products/", {
          token,
        }),
      ]);

      setPurchases(unwrap(purchaseData));
      setSuppliers(unwrap(supplierData));
      setProducts(unwrap(productData));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load purchases.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ----------------------------- lookups ---------------------------- */

  const supplierMap = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier])),
    [suppliers],
  );

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Select supplier" },
      ...suppliers.map((supplier) => ({
        value: String(supplier.id),
        label: supplier.name,
      })),
    ],
    [suppliers],
  );

  const productOptions = useMemo(
    () => [
      { value: "", label: "Select product" },
      ...products.map((product) => ({
        value: String(product.id),
        label: `${product.name} — ${product.sku}`,
      })),
    ],
    [products],
  );

  function supplierName(id: number) {
    return supplierMap.get(id)?.name || `Supplier #${id}`;
  }

  const viewPurchase =
    viewPurchaseId !== null
      ? purchases.find((purchase) => purchase.id === viewPurchaseId) || null
      : null;

  /* ----------------------------- derived ---------------------------- */

  const filteredPurchases = useMemo(() => {
    const query = search.trim().toLowerCase();

    return purchases.filter((purchase) => {
      const name = (
        supplierMap.get(purchase.supplier)?.name || ""
      ).toLowerCase();

      const matchesSearch =
        !query ||
        purchase.purchase_number.toLowerCase().includes(query) ||
        name.includes(query);

      const matchesStatus =
        statusFilter === "all" || purchase.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" || purchase.payment_status === paymentFilter;

      return matchesSearch && matchesStatus && matchesPayment;
    });
  }, [purchases, search, statusFilter, paymentFilter, supplierMap]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, paymentFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredPurchases.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedPurchases = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredPurchases.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredPurchases, page]);

  const stats = useMemo(() => {
    const totalValue = purchases.reduce(
      (sum, purchase) => sum + Number(purchase.total_amount || 0),
      0,
    );

    const outstanding = purchases.reduce(
      (sum, purchase) =>
        purchase.status === "cancelled"
          ? sum
          : sum + outstandingAmount(purchase),
      0,
    );

    return {
      totalPurchases: purchases.length,
      totalValue,
      draft: purchases.filter((purchase) => purchase.status === "draft")
        .length,
      ordered: purchases.filter((purchase) => purchase.status === "ordered")
        .length,
      receiving: purchases.filter(
        (purchase) => purchase.status === "partially_received",
      ).length,
      received: purchases.filter((purchase) => purchase.status === "received")
        .length,
      outstanding,
    };
  }, [purchases]);

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setPage(1);
  }

  /* ---------------------------- purchase form ----------------------- */

  function resetForm() {
    setEditingPurchase(null);
    setSupplierId("");
    setPurchaseDate(today());
    setExpectedDeliveryDate("");
    setNotes("");
    setItems([emptyItem()]);
  }

  function openCreateForm() {
    resetForm();
    setError("");
    setShowForm(true);
  }

  function openEditForm(purchase: Purchase) {
    if (purchase.status !== "draft") {
      setError("Only draft purchases can be edited.");
      return;
    }

    setEditingPurchase(purchase);
    setSupplierId(String(purchase.supplier));
    setPurchaseDate(dateOnly(purchase.purchase_date));
    setExpectedDeliveryDate(dateOnly(purchase.expected_delivery_date));
    setNotes(purchase.notes || "");

    setItems(
      purchase.items.length > 0
        ? purchase.items.map((item) => ({
            product: String(item.product),
            quantity: String(item.quantity),
            unit_cost: String(item.unit_cost),
            tax_rate: String(item.tax_rate),
            discount_amount: String(item.discount_amount),
          }))
        : [emptyItem()],
    );

    setError("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving) return;
    setShowForm(false);
    resetForm();
  }

  function updateItem(
    index: number,
    field: keyof PurchaseItemForm,
    value: string,
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    );
  }

  function handleProductChange(index: number, productId: string) {
    const product = productMap.get(Number(productId));

    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? {
              ...item,
              product: productId,
              unit_cost:
                product && !item.unit_cost
                  ? String(product.cost_price)
                  : item.unit_cost,
              tax_rate:
                product && item.tax_rate === "0"
                  ? String(product.tax_rate)
                  : item.tax_rate,
            }
          : item,
      ),
    );
  }

  function addItem() {
    setItems((current) => [...current, emptyItem()]);
  }

  function removeItem(index: number) {
    setItems((current) =>
      current.length === 1
        ? current
        : current.filter((_, itemIndex) => itemIndex !== index),
    );
  }

  const formTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let discount = 0;

    for (const item of items) {
      const quantity = Number(item.quantity || 0);
      const unitCost = Number(item.unit_cost || 0);
      const taxRate = Number(item.tax_rate || 0);
      const itemDiscount = Number(item.discount_amount || 0);

      const gross = quantity * unitCost;
      const taxable = Math.max(gross - itemDiscount, 0);

      /* Matches the backend: total = subtotal - discount + tax. */
      subtotal += gross;
      discount += itemDiscount;
      tax += taxable * (taxRate / 100);
    }

    return { subtotal, discount, tax, total: subtotal - discount + tax };
  }, [items]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (!supplierId) {
      setError("Select a supplier.");
      return;
    }

    if (!purchaseDate) {
      setError("Select a purchase date.");
      return;
    }

    if (!items.length) {
      setError("A purchase must contain at least one item.");
      return;
    }

    for (const item of items) {
      if (!item.product) {
        setError("Select a product for every purchase item.");
        return;
      }

      const quantity = Number(item.quantity);
      const unitCost = Number(item.unit_cost);
      const taxRate = Number(item.tax_rate || 0);
      const discount = Number(item.discount_amount || 0);

      if (!(quantity > 0)) {
        setError("Quantity must be greater than zero.");
        return;
      }

      if (item.unit_cost === "" || unitCost < 0 || Number.isNaN(unitCost)) {
        setError("Enter a valid unit cost for every item.");
        return;
      }

      if (taxRate < 0 || taxRate > 100 || Number.isNaN(taxRate)) {
        setError("Tax rate must be between 0 and 100.");
        return;
      }

      if (discount < 0) {
        setError("Discount cannot be negative.");
        return;
      }

      if (discount > quantity * unitCost) {
        setError("A line-item discount cannot exceed the gross item amount.");
        return;
      }
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        supplier: Number(supplierId),
        purchase_date: purchaseDate,
        expected_delivery_date: expectedDeliveryDate || null,
        notes: notes.trim(),
        items: items.map((item) => ({
          product: Number(item.product),
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          tax_rate: Number(item.tax_rate || 0),
          discount_amount: Number(item.discount_amount || 0),
        })),
      };

      if (editingPurchase) {
        await apiFetch(`/api/purchases/${editingPurchase.id}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });

        notify("Purchase updated successfully.");
      } else {
        await apiFetch("/api/purchases/", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });

        notify("Purchase created successfully.");
      }

      setShowForm(false);
      resetForm();
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save purchase.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* ------------------- confirm dialog (order/cancel/delete) --------- */

  function requestAction(kind: "order" | "cancel" | "delete", purchase: Purchase) {
    if (kind === "delete" && purchase.status !== "draft") {
      setError("Only draft purchases can be deleted.");
      return;
    }

    setError("");
    setConfirmTarget({ kind, purchase });
  }

  async function handleConfirm() {
    if (!confirmTarget) return;

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    const { kind, purchase } = confirmTarget;

    try {
      setConfirming(true);
      setError("");

      if (kind === "delete") {
        await apiFetch(`/api/purchases/${purchase.id}/`, {
          method: "DELETE",
          token,
        });

        notify("Draft purchase deleted.");
      } else {
        await apiFetch(`/api/purchases/${purchase.id}/${kind}/`, {
          method: "POST",
          token,
          body: JSON.stringify({}),
        });

        notify(
          kind === "order"
            ? "Purchase ordered successfully."
            : "Purchase cancelled successfully.",
        );
      }

      setConfirmTarget(null);
      await loadData();
    } catch (err) {
      setConfirmTarget(null);
      setError(
        err instanceof Error
          ? err.message
          : `Failed to ${kind} purchase.`,
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

    const number = confirmTarget.purchase.purchase_number;

    if (confirmTarget.kind === "order") {
      return {
        title: "Order purchase?",
        description: `Order ${number}? This will move it out of draft status.`,
        label: "Place order",
        cancel: "Not yet",
        danger: false,
      };
    }

    if (confirmTarget.kind === "cancel") {
      return {
        title: "Cancel purchase?",
        description: `Cancel ${number}?`,
        label: "Cancel purchase",
        cancel: "Keep purchase",
        danger: true,
      };
    }

    return {
      title: "Delete draft purchase?",
      description: `Delete draft purchase ${number}? This action cannot be undone.`,
      label: "Delete purchase",
      cancel: "Keep draft",
      danger: true,
    };
  })();

  /* ----------------------------- receiving -------------------------- */

  function openReceiveModal(purchase: Purchase) {
    const receivingItems = purchase.items
      .map((item) => {
        const ordered = Number(item.quantity || 0);
        const received = Number(item.received_quantity || 0);
        const remaining = Math.max(ordered - received, 0);

        const product = productMap.get(item.product);

        return {
          purchaseItemId: item.id || 0,
          productName: product?.name || `Product #${item.product}`,
          orderedQuantity: ordered,
          alreadyReceivedQuantity: received,
          remainingQuantity: remaining,
          receiveQuantity: "",
        };
      })
      .filter((item) => item.purchaseItemId && item.remainingQuantity > 0);

    setReceivePurchaseData(purchase);
    setReceiveItems(receivingItems);
    setReceiveNotes("");
    setError("");
  }

  function closeReceiveModal() {
    if (actionLoading !== null) return;
    setReceivePurchaseData(null);
    setReceiveItems([]);
  }

  function updateReceiveQuantity(purchaseItemId: number, value: string) {
    const numericValue = Math.max(Number(value || 0), 0);

    setReceiveItems((current) =>
      current.map((item) =>
        item.purchaseItemId === purchaseItemId
          ? {
              ...item,
              receiveQuantity:
                numericValue > item.remainingQuantity
                  ? String(item.remainingQuantity)
                  : value,
            }
          : item,
      ),
    );
  }

  async function handleReceive(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !receivePurchaseData) return;

    const validItems = receiveItems
      .map((item) => ({
        ...item,
        numericQuantity: Number(item.receiveQuantity || 0),
      }))
      .filter((item) => item.numericQuantity > 0);

    if (!validItems.length) {
      setError("Enter at least one quantity to receive.");
      return;
    }

    try {
      setActionLoading(receivePurchaseData.id);
      setError("");

      await apiFetch(`/api/purchases/${receivePurchaseData.id}/receive/`, {
        method: "POST",
        token,
        body: JSON.stringify({
          items: validItems.map((item) => ({
            /* The backend expects purchase_item_id. */
            purchase_item_id: item.purchaseItemId,
            quantity: item.numericQuantity,
          })),
        }),
      });

      notify("Purchase receiving recorded successfully.");
      setReceivePurchaseData(null);
      setReceiveItems([]);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to receive purchase.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  /* ------------------------------ payment --------------------------- */

  function openPaymentModal(purchase: Purchase) {
    const remaining = outstandingAmount(purchase);

    setPaymentPurchase(purchase);
    setPaymentAmount(remaining ? remaining.toFixed(2) : "");
    setPaymentMethod("cash");
    setPaymentReference("");
    setPaymentNotes("");
    setError("");
  }

  function closePaymentModal() {
    if (actionLoading !== null) return;
    setPaymentPurchase(null);
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token || !paymentPurchase) return;

    const amount = Number(paymentAmount);

    if (!(amount > 0)) {
      setError("Payment amount must be greater than zero.");
      return;
    }

    const outstanding =
      Number(paymentPurchase.total_amount || 0) - paidAmount(paymentPurchase);

    if (amount > outstanding) {
      setError(
        `Payment cannot exceed the outstanding balance of ${ksh(outstanding)}.`,
      );
      return;
    }

    try {
      setActionLoading(paymentPurchase.id);
      setError("");

      await apiFetch(`/api/purchases/${paymentPurchase.id}/pay/`, {
        method: "POST",
        token,
        body: JSON.stringify({
          amount,
          payment_method: paymentMethod,
          reference: paymentReference.trim(),
          notes: paymentNotes.trim(),
        }),
      });

      notify("Purchase payment recorded successfully.");
      setPaymentPurchase(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to record payment.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  /* ----------------------------- columns ---------------------------- */

  const purchaseColumns: Column<Purchase>[] = [
    {
      key: "purchase_number",
      label: "Purchase",
      render: (purchase) => (
        <div className="min-w-0">
          <p className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
            {purchase.purchase_number}
          </p>
          <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
            {purchase.items.length} item
            {purchase.items.length === 1 ? "" : "s"}
          </p>
        </div>
      ),
    },
    {
      key: "supplier",
      label: "Supplier",
      render: (purchase) => (
        <span className="break-words text-[var(--charcoal-700)]">
          {supplierName(purchase.supplier)}
        </span>
      ),
    },
    {
      key: "purchase_date",
      label: "Date",
      hideBelow: "md",
      render: (purchase) => (
        <span className="whitespace-nowrap text-[var(--charcoal-600)]">
          {displayDate(purchase.purchase_date)}
        </span>
      ),
    },
    {
      key: "expected_delivery_date",
      label: "Delivery",
      hideBelow: "lg",
      render: (purchase) => (
        <span className="whitespace-nowrap text-[var(--charcoal-600)]">
          {displayDate(purchase.expected_delivery_date)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (purchase) => <StatusBadge status={purchase.status} />,
    },
    {
      key: "payment_status",
      label: "Payment",
      render: (purchase) => (
        <div className="min-w-0">
          <StatusBadge status={purchase.payment_status} />
          {purchase.payment_status !== "paid" && (
            <p className="mt-1.5 whitespace-nowrap text-xs tabular-nums text-[var(--charcoal-500)]">
              {ksh(outstandingAmount(purchase))} due
            </p>
          )}
        </div>
      ),
    },
    {
      key: "total_amount",
      label: "Total",
      align: "right",
      render: (purchase) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {ksh(purchase.total_amount)}
        </span>
      ),
    },
    {
      key: "id",
      label: "Actions",
      render: (purchase) => {
        const busy = actionLoading === purchase.id;

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {purchase.status === "draft" && (
              <>
                <Button
                  size="sm"
                  disabled={busy}
                  onClick={() => requestAction("order", purchase)}
                >
                  Order
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => openEditForm(purchase)}
                >
                  Edit
                </Button>
              </>
            )}

            {(purchase.status === "ordered" ||
              purchase.status === "partially_received") && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => openReceiveModal(purchase)}
              >
                {purchase.status === "partially_received"
                  ? "Receive remaining"
                  : "Receive"}
              </Button>
            )}

            {purchase.status !== "cancelled" &&
              purchase.status !== "draft" &&
              purchase.payment_status !== "paid" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => openPaymentModal(purchase)}
                >
                  Pay
                </Button>
              )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewPurchaseId(purchase.id)}
            >
              View
            </Button>

            {purchase.status === "ordered" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => requestAction("cancel", purchase)}
              >
                <span className="text-red-700">Cancel</span>
              </Button>
            )}

            {purchase.status === "draft" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => requestAction("delete", purchase)}
              >
                <span className="text-red-700">Delete</span>
              </Button>
            )}
          </div>
        );
      },
    },
  ];

  /* ------------------------------ render ---------------------------- */

  const modalOpen =
    showForm || receivePurchaseData !== null || paymentPurchase !== null;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Toast
        open={Boolean(successMessage)}
        message={successMessage}
        tone="success"
        onClose={() => setSuccessMessage("")}
      />

      <PageHeader
        title="Purchases"
        subtitle="Manage supplier orders, receiving, stock intake and purchase payments."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Purchases" },
        ]}
        action={<Button onClick={openCreateForm}>+ New purchase</Button>}
      />

      {error && !modalOpen && (
        <ErrorState
          title="Purchase operation failed"
          message={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void loadData()}>
              Retry loading
            </Button>
          }
        />
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total purchases"
          value={stats.totalPurchases.toLocaleString()}
          hint={`${ksh(stats.totalValue)} total value`}
          tone="default"
        />
        <StatCard
          label="Outstanding"
          value={ksh(stats.outstanding)}
          hint="Supplier balance"
          tone={stats.outstanding > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Awaiting receipt"
          value={(stats.ordered + stats.receiving).toLocaleString()}
          hint={`${stats.receiving} partially received`}
          tone="default"
        />
        <StatCard
          label="Fully received"
          value={stats.received.toLocaleString()}
          hint={`${stats.draft} draft purchases`}
          tone="default"
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Purchase records
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Track orders, deliveries and supplier payments.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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

        <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 md:grid-cols-[minmax(220px,1fr)_190px_170px_auto]">
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Search purchase number or supplier..."
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={statusFilterOptions}
            aria-label="Filter purchase status"
          />

          <Select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            options={paymentFilterOptions}
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
              {filteredPurchases.length}
            </span>{" "}
            of {purchases.length} purchases
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingState rows={5} />
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title={
                purchases.length === 0
                  ? "No purchases yet"
                  : "No matching purchases"
              }
              hint={
                purchases.length === 0
                  ? "Create a purchase to start ordering stock from suppliers."
                  : "Try a different search term or clear your filters."
              }
              action={
                purchases.length === 0 ? (
                  <Button onClick={openCreateForm}>+ New purchase</Button>
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
              columns={purchaseColumns}
              rows={paginatedPurchases}
              rowKey={(purchase) => purchase.id}
              emptyMessage="No purchases found."
            />
            <Pagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredPurchases.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* PURCHASE FORM MODAL */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={
          editingPurchase
            ? `Edit ${editingPurchase.purchase_number}`
            : "New purchase"
        }
        description={
          editingPurchase
            ? "Purchase numbers are generated by BuildOps and cannot be changed."
            : "The purchase number is generated automatically."
        }
        size="xl"
      >
        <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <FormField label="Supplier" required>
              <Select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                options={supplierOptions}
                required
              />
            </FormField>

            <FormField label="Purchase date" required>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(event) => setPurchaseDate(event.target.value)}
                required
              />
            </FormField>

            <FormField label="Expected delivery">
              <Input
                type="date"
                value={expectedDeliveryDate}
                onChange={(event) =>
                  setExpectedDeliveryDate(event.target.value)
                }
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className={fieldClass}
              placeholder="Optional purchase notes..."
            />
          </FormField>

          <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
                  Purchase items
                </h3>
                <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
                  Add the products and supplier costs for this purchase.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addItem}
              >
                + Add item
              </Button>
            </div>

            {items.map((item, index) => (
              <div
                key={index}
                className="min-w-0 space-y-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3"
              >
                <FormField label={`Product (item ${index + 1})`} required>
                  <Select
                    value={item.product}
                    onChange={(event) =>
                      handleProductChange(index, event.target.value)
                    }
                    options={productOptions}
                    required
                  />
                </FormField>

                <div className="grid grid-cols-1 gap-3 xs:grid-cols-2 sm:grid-cols-4">
                  <FormField label="Quantity" required>
                    <Input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={item.quantity}
                      onChange={(event) =>
                        updateItem(index, "quantity", event.target.value)
                      }
                      required
                    />
                  </FormField>

                  <FormField label="Unit cost" required>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={item.unit_cost}
                      onChange={(event) =>
                        updateItem(index, "unit_cost", event.target.value)
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
                        updateItem(index, "tax_rate", event.target.value)
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
                        updateItem(
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
                    onClick={() => removeItem(index)}
                    disabled={items.length === 1}
                  >
                    <span className="text-red-700">Remove</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>

          <div className="w-full max-w-sm rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 sm:ml-auto">
            <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
              Estimated totals
            </h3>
            <div className="mt-3 space-y-2">
              <SummaryRow label="Subtotal" value={ksh(formTotals.subtotal)} />
              <SummaryRow label="Discount" value={ksh(formTotals.discount)} />
              <SummaryRow label="Tax" value={ksh(formTotals.tax)} />
              <div className="border-t border-[var(--border-soft)] pt-2">
                <SummaryRow
                  label="Total"
                  value={ksh(formTotals.total)}
                  strong
                />
              </div>
            </div>
          </div>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingPurchase ? "Update purchase" : "Create purchase"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* RECEIVE MODAL */}
      <Modal
        open={receivePurchaseData !== null}
        onClose={closeReceiveModal}
        title={
          receivePurchaseData
            ? `Receive ${receivePurchaseData.purchase_number}`
            : "Receive purchase"
        }
        description="Record only the quantities physically received. BuildOps updates inventory automatically."
        size="lg"
      >
        <form onSubmit={handleReceive} className="min-w-0 space-y-5">
          <ModalError message={error} />

          {receivePurchaseData && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[var(--charcoal-500)]">
                  Receiving purchase
                </p>
                <p className="mt-1 break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
                  {receivePurchaseData.purchase_number}
                </p>
              </div>
              <StatusBadge status={receivePurchaseData.status} />
            </div>
          )}

          {receiveItems.length === 0 ? (
            <p className="rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 text-center text-sm text-[var(--charcoal-600)]">
              There are no outstanding quantities to receive.
            </p>
          ) : (
            <div className="space-y-3">
              {receiveItems.map((item) => (
                <div
                  key={item.purchaseItemId}
                  className="flex flex-col gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="break-words font-semibold text-[var(--charcoal-900)]">
                      {item.productName}
                    </p>
                    <p className="mt-1.5 text-xs text-[var(--charcoal-500)]">
                      Ordered {item.orderedQuantity} · Received{" "}
                      {item.alreadyReceivedQuantity} ·{" "}
                      <span className="font-semibold text-[var(--charcoal-800)]">
                        Remaining {item.remainingQuantity}
                      </span>
                    </p>
                  </div>

                  <div className="w-full shrink-0 sm:w-32">
                    <Input
                      type="number"
                      min="0"
                      max={item.remainingQuantity}
                      step="0.01"
                      value={item.receiveQuantity}
                      onChange={(event) =>
                        updateReceiveQuantity(
                          item.purchaseItemId,
                          event.target.value,
                        )
                      }
                      placeholder="Receive now"
                      aria-label={`Receive quantity for ${item.productName}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <FormField label="Receiving notes">
            <textarea
              value={receiveNotes}
              onChange={(event) => setReceiveNotes(event.target.value)}
              rows={2}
              className={fieldClass}
              placeholder="Optional receiving notes..."
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeReceiveModal}
              disabled={actionLoading !== null}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={
                receivePurchaseData !== null &&
                actionLoading === receivePurchaseData.id
              }
              disabled={receiveItems.length === 0}
            >
              {receivePurchaseData?.status === "partially_received"
                ? "Receive remaining"
                : "Record receiving"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal
        open={paymentPurchase !== null}
        onClose={closePaymentModal}
        title={
          paymentPurchase
            ? `Pay ${paymentPurchase.purchase_number}`
            : "Record payment"
        }
        description="Payments become permanent once recorded."
        size="lg"
      >
        <form onSubmit={handlePayment} className="min-w-0 space-y-5">
          <ModalError message={error} />

          {paymentPurchase && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <InfoCard
                label="Purchase total"
                value={ksh(paymentPurchase.total_amount)}
              />
              <InfoCard
                label="Paid"
                value={ksh(paidAmount(paymentPurchase))}
              />
              <InfoCard
                label="Outstanding"
                value={ksh(outstandingAmount(paymentPurchase))}
              />
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount" required>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={paymentAmount}
                onChange={(event) => setPaymentAmount(event.target.value)}
                required
              />
            </FormField>

            <FormField label="Payment method" required>
              <Select
                value={paymentMethod}
                onChange={(event) =>
                  setPaymentMethod(event.target.value as PaymentMethod)
                }
                options={PAYMENT_METHOD_OPTIONS}
                required
              />
            </FormField>
          </div>

          <FormField label="Reference">
            <Input
              value={paymentReference}
              onChange={(event) => setPaymentReference(event.target.value)}
              placeholder="e.g. MPESA123456"
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              value={paymentNotes}
              onChange={(event) => setPaymentNotes(event.target.value)}
              rows={2}
              className={fieldClass}
              placeholder="Optional payment notes..."
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closePaymentModal}
              disabled={actionLoading !== null}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={
                paymentPurchase !== null &&
                actionLoading === paymentPurchase.id
              }
            >
              Record payment
            </Button>
          </div>
        </form>
      </Modal>

      {/* DETAILS DRAWER */}
      <Drawer
        open={viewPurchase !== null}
        onClose={() => setViewPurchaseId(null)}
        title={viewPurchase ? viewPurchase.purchase_number : "Purchase"}
        description={
          viewPurchase ? supplierName(viewPurchase.supplier) : undefined
        }
        width="lg"
      >
        {viewPurchase && (
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={viewPurchase.status} />
              <StatusBadge status={viewPurchase.payment_status} />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard
                label="Purchase date"
                value={displayDate(viewPurchase.purchase_date)}
              />
              <InfoCard
                label="Expected delivery"
                value={displayDate(viewPurchase.expected_delivery_date)}
              />
              <InfoCard
                label="Supplier"
                value={supplierName(viewPurchase.supplier)}
              />
              <InfoCard
                label="Payment due"
                value={ksh(outstandingAmount(viewPurchase))}
              />
            </div>

            <section className="min-w-0">
              <h3 className="mb-3 text-sm font-semibold text-[var(--charcoal-900)]">
                Purchase items
              </h3>

              <div className="space-y-2">
                {viewPurchase.items.map((item, index) => {
                  const product = productMap.get(item.product);
                  const ordered = Number(item.quantity || 0);
                  const received = Number(item.received_quantity || 0);
                  const remaining = Math.max(ordered - received, 0);

                  return (
                    <div
                      key={item.id || index}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border-soft)] p-3"
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
                          Ordered {ordered} · Received {received} ·{" "}
                          <span
                            className={
                              remaining > 0
                                ? "font-semibold text-amber-700"
                                : "text-[var(--charcoal-500)]"
                            }
                          >
                            Remaining {remaining}
                          </span>{" "}
                          · {ksh(item.unit_cost)} each
                        </p>
                      </div>
                      <p className="shrink-0 tabular-nums text-sm font-semibold text-[var(--charcoal-900)]">
                        {ksh(item.line_total)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="min-w-0">
              <h3 className="mb-3 text-sm font-semibold text-[var(--charcoal-900)]">
                Financial summary
              </h3>

              <div className="space-y-2 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4">
                <SummaryRow
                  label="Subtotal"
                  value={ksh(viewPurchase.subtotal)}
                />
                <SummaryRow
                  label="Discount"
                  value={ksh(viewPurchase.discount_amount)}
                />
                <SummaryRow label="Tax" value={ksh(viewPurchase.tax_amount)} />
                <div className="border-t border-[var(--border-soft)] pt-2">
                  <SummaryRow
                    label="Total"
                    value={ksh(viewPurchase.total_amount)}
                    strong
                  />
                </div>
                <div className="space-y-2 border-t border-[var(--border-soft)] pt-2">
                  <SummaryRow
                    label="Paid"
                    value={ksh(paidAmount(viewPurchase))}
                  />
                  <SummaryRow
                    label="Outstanding"
                    value={ksh(outstandingAmount(viewPurchase))}
                    strong
                  />
                </div>
              </div>
            </section>

            <section className="min-w-0">
              <h3 className="mb-3 text-sm font-semibold text-[var(--charcoal-900)]">
                Payment history
              </h3>

              {viewPurchase.payments.length === 0 ? (
                <p className="rounded-lg border border-[var(--border-soft)] p-4 text-sm text-[var(--charcoal-500)]">
                  No payments recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {viewPurchase.payments.map((payment) => (
                    <div
                      key={payment.id}
                      className="rounded-lg border border-[var(--border-soft)] p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="break-words text-sm font-semibold text-[var(--charcoal-900)]">
                            {paymentMethodLabel(payment.payment_method)}
                          </p>
                          <p className="mt-0.5 break-words text-xs text-[var(--charcoal-500)]">
                            {displayDate(payment.created_at)}
                            {payment.reference
                              ? ` · Ref: ${payment.reference}`
                              : ""}
                          </p>
                        </div>
                        <p className="shrink-0 tabular-nums text-sm font-semibold text-[var(--charcoal-900)]">
                          {ksh(payment.amount)}
                        </p>
                      </div>
                      {payment.notes && (
                        <p className="mt-2 break-words border-t border-[var(--border-soft)] pt-2 text-xs text-[var(--charcoal-500)]">
                          {payment.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {viewPurchase.notes && (
              <section className="min-w-0">
                <h3 className="mb-3 text-sm font-semibold text-[var(--charcoal-900)]">
                  Purchase notes
                </h3>
                <p className="break-words rounded-lg border border-[var(--border-soft)] p-3 text-sm text-[var(--charcoal-600)]">
                  {viewPurchase.notes}
                </p>
              </section>
            )}
          </div>
        )}
      </Drawer>

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