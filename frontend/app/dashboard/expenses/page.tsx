"use client";

import { DEFAULT_PAGE_SIZE } from "@/components/ui/Pagination";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type ExpenseCategory = {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
};

type PaymentMethod = "cash" | "mpesa" | "card" | "bank_transfer";

type Expense = {
  id: number;
  expense_number: string;
  category: number;
  category_name?: string;
  description: string;
  amount: string | number;
  expense_date: string;
  payment_method: PaymentMethod;
  status: "pending" | "approved" | "paid" | "cancelled";
  paid_to: string;
  receipt_number?: string;
  reference?: string;
  notes?: string;
  created_by?: number;
  approved_by?: number | null;
  approved_at?: string | null;
  paid_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

type PaginatedResponse<T> = {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
};

type ExpenseForm = {
  category: string;
  description: string;
  amount: string;
  expense_date: string;
  payment_method: PaymentMethod;
  paid_to: string;
  receipt_number: string;
  reference: string;
  notes: string;
};

type ConfirmTarget = {
  kind: "delete" | "cancel";
  expense: Expense;
} | null;

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "mpesa", label: "M-Pesa" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
];


const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const paymentFilterOptions = [
  { value: "all", label: "All payments" },
  ...paymentMethodOptions,
];

const fieldClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:min-h-0 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

function todayString() {
  return new Date().toISOString().split("T")[0];
}

function emptyForm(): ExpenseForm {
  return {
    category: "",
    description: "",
    amount: "",
    expense_date: todayString(),
    payment_method: "cash",
    paid_to: "",
    receipt_number: "",
    reference: "",
    notes: "",
  };
}

function ksh(value: string | number | null | undefined) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(
    new Date(value),
  );
}

function paymentLabel(value: PaymentMethod) {
  return paymentMethodOptions.find((method) => method.value === value)?.label || value;
}

function normalizeCategoryName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function unwrap<T>(data: T[] | PaginatedResponse<T>): T[] {
  return Array.isArray(data) ? data : data.results;
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

export default function ExpensesPage() {
  const token = getToken();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categorySaving, setCategorySaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [form, setForm] = useState<ExpenseForm>(emptyForm());

  const [categorySearch, setCategorySearch] = useState("");
  const [categoryOpen, setCategoryOpen] = useState(false);
  const categoryContainerRef = useRef<HTMLDivElement | null>(null);

  const [paymentExpense, setPaymentExpense] = useState<Expense | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");

  const [viewExpenseId, setViewExpenseId] = useState<number | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget>(null);

  /* ----------------------------- toast ------------------------------ */

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

      const [expenseData, categoryData] = await Promise.all([
        apiFetch<Expense[] | PaginatedResponse<Expense>>("/api/expenses/", {
          token,
        }),
        apiFetch<ExpenseCategory[] | PaginatedResponse<ExpenseCategory>>(
          "/api/expense-categories/",
          { token },
        ),
      ]);

      setExpenses(unwrap(expenseData));
      setCategories(unwrap(categoryData));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load expenses.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* Close the category dropdown when clicking outside of it. */
  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        categoryContainerRef.current &&
        !categoryContainerRef.current.contains(event.target as Node)
      ) {
        setCategoryOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);

    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  /* ----------------------------- derived ---------------------------- */

  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category.name])),
    [categories],
  );

  const activeCategories = useMemo(
    () => categories.filter((category) => category.is_active),
    [categories],
  );

  const filteredCategoryOptions = useMemo(() => {
    const query = normalizeCategoryName(categorySearch);

    if (!query) return activeCategories;

    return activeCategories.filter((category) =>
      normalizeCategoryName(category.name).includes(query),
    );
  }, [activeCategories, categorySearch]);

  const exactCategoryMatch = useMemo(() => {
    const normalized = normalizeCategoryName(categorySearch);

    if (!normalized) return null;

    return (
      activeCategories.find(
        (category) => normalizeCategoryName(category.name) === normalized,
      ) || null
    );
  }, [activeCategories, categorySearch]);

  const categoryFilterOptions = useMemo(
    () => [
      { value: "all", label: "All categories" },
      ...categories.map((category) => ({
        value: String(category.id),
        label: category.name,
      })),
    ],
    [categories],
  );

  const enrichedExpenses = useMemo(
    () =>
      expenses.map((expense) => ({
        ...expense,
        category_name:
          expense.category_name ||
          categoryMap.get(expense.category) ||
          "Uncategorised",
      })),
    [expenses, categoryMap],
  );

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();

    return enrichedExpenses.filter((expense) => {
      const matchesSearch =
        !query ||
        expense.expense_number.toLowerCase().includes(query) ||
        expense.description.toLowerCase().includes(query) ||
        expense.paid_to.toLowerCase().includes(query) ||
        (expense.reference || "").toLowerCase().includes(query) ||
        (expense.receipt_number || "").toLowerCase().includes(query) ||
        (expense.category_name || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || expense.status === statusFilter;

      const matchesPayment =
        paymentFilter === "all" || expense.payment_method === paymentFilter;

      const matchesCategory =
        categoryFilter === "all" || String(expense.category) === categoryFilter;

      return (
        matchesSearch && matchesStatus && matchesPayment && matchesCategory
      );
    });
  }, [enrichedExpenses, search, statusFilter, paymentFilter, categoryFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, paymentFilter, categoryFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredExpenses.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedExpenses = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredExpenses.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredExpenses, page]);

  const stats = useMemo(() => {
    const sumBy = (status?: Expense["status"]) =>
      enrichedExpenses
        .filter((expense) => !status || expense.status === status)
        .reduce((sum, expense) => sum + Number(expense.amount || 0), 0);

    return {
      total: sumBy(),
      paid: sumBy("paid"),
      pending: sumBy("pending"),
      approved: sumBy("approved"),
      count: enrichedExpenses.length,
    };
  }, [enrichedExpenses]);

  const viewExpense =
    viewExpenseId !== null
      ? enrichedExpenses.find((expense) => expense.id === viewExpenseId) || null
      : null;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPaymentFilter("all");
    setCategoryFilter("all");
    setPage(1);
  }

  /* ------------------------------ form ------------------------------ */

  function resetForm() {
    setForm(emptyForm());
    setCategorySearch("");
    setCategoryOpen(false);
    setEditingExpense(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
    setError("");
  }

  function openEditForm(expense: Expense) {
    if (expense.status !== "pending") {
      setError("Only pending expenses can be edited.");
      return;
    }

    setEditingExpense(expense);

    setForm({
      category: String(expense.category),
      description: expense.description,
      amount: String(expense.amount),
      expense_date: expense.expense_date,
      payment_method: expense.payment_method,
      paid_to: expense.paid_to,
      receipt_number: expense.receipt_number || "",
      reference: expense.reference || "",
      notes: expense.notes || "",
    });

    setCategorySearch(
      expense.category_name || categoryMap.get(expense.category) || "",
    );
    setCategoryOpen(false);
    setShowForm(true);
    setError("");
  }

  function closeForm() {
    if (saving || categorySaving) return;
    setShowForm(false);
    resetForm();
  }

  function updateField<K extends keyof ExpenseForm>(
    field: K,
    value: ExpenseForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function selectCategory(category: ExpenseCategory) {
    setForm((current) => ({ ...current, category: String(category.id) }));
    setCategorySearch(category.name);
    setCategoryOpen(false);
    setError("");
  }

  async function createCategory(): Promise<ExpenseCategory | null> {
    if (!token) {
      setError("You are not authenticated.");
      return null;
    }

    const cleanedName = categorySearch.trim().replace(/\s+/g, " ");

    if (!cleanedName) {
      setError("Enter a category name first.");
      return null;
    }

    const normalizedName = normalizeCategoryName(cleanedName);

    const existingCategory = activeCategories.find(
      (category) => normalizeCategoryName(category.name) === normalizedName,
    );

    if (existingCategory) {
      selectCategory(existingCategory);
      return existingCategory;
    }

    try {
      setCategorySaving(true);
      setError("");

      const created = await apiFetch<ExpenseCategory>(
        "/api/expense-categories/",
        {
          token,
          method: "POST",
          body: JSON.stringify({ name: cleanedName }),
        },
      );

      setCategories((current) =>
        current.some((category) => category.id === created.id)
          ? current
          : [...current, created],
      );

      setForm((current) => ({ ...current, category: String(created.id) }));
      setCategorySearch(created.name);
      setCategoryOpen(false);
      setSuccessMessage(`Category "${created.name}" created.`);

      return created;
    } catch (err) {
      try {
        const refreshed = unwrap(
          await apiFetch<ExpenseCategory[] | PaginatedResponse<ExpenseCategory>>(
            "/api/expense-categories/",
            { token },
          ),
        );

        setCategories(refreshed);

        const matchingCategory = refreshed.find(
          (category) =>
            category.is_active &&
            normalizeCategoryName(category.name) === normalizedName,
        );

        if (matchingCategory) {
          selectCategory(matchingCategory);
          setSuccessMessage(
            `Using existing category "${matchingCategory.name}".`,
          );

          return matchingCategory;
        }
      } catch {
        /* Keep the original error below. */
      }

      setError(
        err instanceof Error
          ? err.message
          : "Failed to create expense category.",
      );

      return null;
    } finally {
      setCategorySaving(false);
    }
  }

  async function handleCategoryKeyDown(
    event: ReactKeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Escape") {
      setCategoryOpen(false);
      return;
    }

    if (event.key !== "Enter") return;

    event.preventDefault();

    if (exactCategoryMatch) {
      selectCategory(exactCategoryMatch);
      return;
    }

    if (categorySearch.trim()) {
      await createCategory();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (!form.description.trim()) {
      setError("Expense description is required.");
      return;
    }

    if (!form.amount || Number(form.amount) <= 0) {
      setError("Expense amount must be greater than zero.");
      return;
    }

    if (!form.expense_date) {
      setError("Select an expense date.");
      return;
    }

    if (!form.paid_to.trim()) {
      setError("Please specify who the expense was paid to.");
      return;
    }

    if (!form.category && !categorySearch.trim()) {
      setError("Please select or create an expense category.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      let categoryId = form.category;

      if (!categoryId) {
        const category = await createCategory();

        if (!category) return;

        categoryId = String(category.id);
      }

      const payload = {
        category: Number(categoryId),
        description: form.description.trim(),
        amount: form.amount,
        expense_date: form.expense_date,
        payment_method: form.payment_method,
        paid_to: form.paid_to.trim(),
        receipt_number: form.receipt_number.trim(),
        reference: form.reference.trim(),
        notes: form.notes.trim(),
      };

      if (editingExpense) {
        await apiFetch<Expense>(`/api/expenses/${editingExpense.id}/`, {
          token,
          method: "PATCH",
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Expense updated successfully.");
      } else {
        await apiFetch<Expense>("/api/expenses/", {
          token,
          method: "POST",
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Expense created successfully.");
      }

      setShowForm(false);
      resetForm();

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save expense.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* ----------------------------- actions ---------------------------- */

  async function runAction(
    expense: Expense,
    action: "approve" | "pay" | "cancel",
    selectedPaymentMethod?: PaymentMethod,
  ): Promise<boolean> {
    if (!token) {
      setError("You are not authenticated.");
      return false;
    }

    try {
      setActionLoading(expense.id);
      setError("");

      await apiFetch(`/api/expenses/${expense.id}/${action}/`, {
        token,
        method: "POST",
        body: JSON.stringify(
          action === "pay" ? { payment_method: selectedPaymentMethod } : {},
        ),
      });

      setSuccessMessage(
        action === "pay"
          ? "Expense marked as paid."
          : action === "approve"
            ? "Expense approved."
            : "Expense cancelled.",
      );

      await loadData();

      return true;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : `Failed to ${action} expense.`,
      );

      return false;
    } finally {
      setActionLoading(null);
    }
  }

  function openPaymentModal(expense: Expense) {
    setPaymentExpense(expense);
    setPaymentMethod(expense.payment_method || "cash");
    setError("");
  }

  function closePaymentModal() {
    if (actionLoading !== null) return;
    setPaymentExpense(null);
  }

  async function handlePaymentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!paymentExpense) return;

    const success = await runAction(paymentExpense, "pay", paymentMethod);

    if (success) {
      setPaymentExpense(null);
      setPaymentMethod("cash");
    }
  }

  function requestDelete(expense: Expense) {
    if (expense.status !== "pending") {
      setError("Only pending expenses can be deleted.");
      return;
    }

    setError("");
    setConfirmTarget({ kind: "delete", expense });
  }

  async function handleConfirm() {
    if (!confirmTarget) return;

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    const { kind, expense } = confirmTarget;

    try {
      setConfirming(true);
      setError("");

      if (kind === "delete") {
        await apiFetch(`/api/expenses/${expense.id}/`, {
          token,
          method: "DELETE",
        });

        if (viewExpenseId === expense.id) setViewExpenseId(null);

        setSuccessMessage("Expense deleted successfully.");
        setConfirmTarget(null);
        await loadData();
      } else {
        setConfirmTarget(null);
        await runAction(expense, "cancel");
      }
    } catch (err) {
      setConfirmTarget(null);
      setError(
        err instanceof Error ? err.message : "Failed to delete expense.",
      );
    } finally {
      setConfirming(false);
    }
  }

  /* ----------------------------- columns ---------------------------- */

  const expenseColumns: Column<(typeof enrichedExpenses)[number]>[] = [
    {
      key: "expense_number",
      label: "Expense",
      render: (expense) => (
        <div className="min-w-0">
          <p className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
            {expense.expense_number}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-xs text-[var(--charcoal-500)]">
            {formatDate(expense.expense_date)}
          </p>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (expense) => (
        <div className="min-w-0">
          <p className="break-words font-medium text-[var(--charcoal-900)]">
            {expense.description}
          </p>
          <p className="mt-0.5 break-words text-xs text-[var(--charcoal-500)]">
            {expense.category_name}
          </p>
        </div>
      ),
    },
    {
      key: "amount",
      label: "Amount",
      render: (expense) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
            {ksh(expense.amount)}
          </p>
          <p className="mt-0.5 whitespace-nowrap text-xs text-[var(--charcoal-500)]">
            {paymentLabel(expense.payment_method)}
          </p>
        </div>
      ),
    },
    {
      key: "paid_to",
      label: "Paid to",
      hideBelow: "md",
      render: (expense) => (
        <span className="break-words text-[var(--charcoal-700)]">
          {expense.paid_to}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      hideBelow: "sm",
      render: (expense) => <StatusBadge status={expense.status} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (expense) => {
        const busy = actionLoading === expense.id;

        return (
          <div className="flex flex-wrap items-center gap-1.5">
            {expense.status === "pending" && (
              <>
                <Button
                  size="sm"
                  loading={busy}
                  onClick={() => void runAction(expense, "approve")}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => openEditForm(expense)}
                >
                  Edit
                </Button>
              </>
            )}

            {expense.status === "approved" && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => openPaymentModal(expense)}
              >
                Mark as paid
              </Button>
            )}

            <Button
              size="sm"
              variant="ghost"
              onClick={() => setViewExpenseId(expense.id)}
            >
              View
            </Button>

            {expense.status === "approved" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmTarget({ kind: "cancel", expense })}
              >
                <span className="text-red-700">Cancel</span>
              </Button>
            )}

            {expense.status === "pending" && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => requestDelete(expense)}
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

  const modalOpen = showForm || paymentExpense !== null;

  const confirmCopy =
    confirmTarget?.kind === "cancel"
      ? {
          title: "Cancel expense?",
          description: `Cancel expense ${confirmTarget.expense.expense_number}? This expense will no longer be payable.`,
          label: "Cancel expense",
          cancel: "Keep expense",
        }
      : {
          title: "Delete expense?",
          description: confirmTarget
            ? `Delete expense ${confirmTarget.expense.expense_number}? This cannot be undone.`
            : "This cannot be undone.",
          label: "Delete expense",
          cancel: "Keep expense",
        };

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Toast
        open={Boolean(successMessage)}
        message={successMessage}
        tone="success"
        onClose={() => setSuccessMessage("")}
      />

      <PageHeader
        title="Expenses"
        subtitle="Track, approve and pay business expenses."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Expenses" },
        ]}
        action={<Button onClick={openCreateForm}>+ Add expense</Button>}
      />

      {error && !modalOpen && (
        <ErrorState
          title="Expense operation failed"
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
          label="Total expenses"
          value={ksh(stats.total)}
          hint={`${stats.count} records`}
          tone="default"
        />
        <StatCard
          label="Paid"
          value={ksh(stats.paid)}
          hint="Completed payments"
          tone="default"
        />
        <StatCard
          label="Pending"
          value={ksh(stats.pending)}
          hint="Awaiting approval"
          tone={stats.pending > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Approved"
          value={ksh(stats.approved)}
          hint="Awaiting payment"
          tone={stats.approved > 0 ? "warning" : "default"}
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Expense records
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Search expenses and move them through approval and payment.
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

        <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_160px_160px_180px_auto]">
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Search expense, payee, receipt or reference..."
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={statusFilterOptions}
            aria-label="Filter expense status"
          />

          <Select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            options={paymentFilterOptions}
            aria-label="Filter payment method"
          />

          <Select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            options={categoryFilterOptions}
            aria-label="Filter expense category"
          />

          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-[var(--charcoal-500)]">
            Showing{" "}
            <span className="font-semibold text-[var(--charcoal-800)]">
              {filteredExpenses.length}
            </span>{" "}
            of {expenses.length} expenses
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingState rows={5} />
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title={
                expenses.length === 0
                  ? "No expenses yet"
                  : "No matching expenses"
              }
              hint={
                expenses.length === 0
                  ? "Add an expense to start tracking business spending."
                  : "Try a different search term or clear your filters."
              }
              action={
                expenses.length === 0 ? (
                  <Button onClick={openCreateForm}>+ Add expense</Button>
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
              columns={expenseColumns}
              rows={paginatedExpenses}
              rowKey={(expense) => expense.id}
              emptyMessage="No expenses found."
            />
            <Pagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredExpenses.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* DETAILS DRAWER */}
      <Drawer
        open={viewExpense !== null}
        onClose={() => setViewExpenseId(null)}
        title={viewExpense ? viewExpense.expense_number : "Expense"}
        description={viewExpense?.description}
        width="md"
      >
        {viewExpense && (
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={viewExpense.status} />
              <p className="text-lg font-semibold tabular-nums text-[var(--charcoal-900)]">
                {ksh(viewExpense.amount)}
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard label="Category" value={viewExpense.category_name} />
              <InfoCard
                label="Expense date"
                value={formatDate(viewExpense.expense_date)}
              />
              <InfoCard label="Paid to" value={viewExpense.paid_to || "—"} />
              <InfoCard
                label="Payment method"
                value={paymentLabel(viewExpense.payment_method)}
              />
              <InfoCard
                label="Receipt number"
                value={viewExpense.receipt_number || "—"}
              />
              <InfoCard
                label="Reference"
                value={viewExpense.reference || "—"}
              />
              <InfoCard
                label="Created"
                value={formatDate(viewExpense.created_at)}
              />
              <InfoCard
                label="Approved"
                value={formatDate(viewExpense.approved_at)}
              />
              <InfoCard label="Paid" value={formatDate(viewExpense.paid_at)} />
            </div>

            {viewExpense.notes && (
              <section className="min-w-0">
                <h3 className="mb-3 text-sm font-semibold text-[var(--charcoal-900)]">
                  Notes
                </h3>
                <p className="break-words rounded-lg border border-[var(--border-soft)] p-3 text-sm text-[var(--charcoal-600)]">
                  {viewExpense.notes}
                </p>
              </section>
            )}
          </div>
        )}
      </Drawer>

      {/* EXPENSE MODAL */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingExpense ? "Edit expense" : "Add expense"}
        description="Expenses start in pending status until they are approved."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          <FormField label="Category" required>
            <div ref={categoryContainerRef} className="relative min-w-0">
              <input
                value={categorySearch}
                onFocus={() => setCategoryOpen(true)}
                onChange={(event) => {
                  const value = event.target.value;

                  setCategorySearch(value);

                  const matching = activeCategories.find(
                    (category) =>
                      normalizeCategoryName(category.name) ===
                      normalizeCategoryName(value),
                  );

                  setForm((current) => ({
                    ...current,
                    category: matching ? String(matching.id) : "",
                  }));

                  setCategoryOpen(true);
                  setError("");
                }}
                onKeyDown={handleCategoryKeyDown}
                className={fieldClass}
                placeholder="Search or type a category..."
                autoComplete="off"
              />

              {categoryOpen && (
                <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto overscroll-contain rounded-lg border border-[var(--border)] bg-white py-1 shadow-lg">
                  {filteredCategoryOptions.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      onClick={() => selectCategory(category)}
                      className={`flex min-h-10 w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-[var(--emerald-50)] ${
                        form.category === String(category.id)
                          ? "bg-[var(--surface-muted)] font-semibold text-[var(--charcoal-900)]"
                          : "text-[var(--charcoal-700)]"
                      }`}
                    >
                      <span className="min-w-0 flex-1 break-words">
                        {category.name}
                      </span>
                      {form.category === String(category.id) && (
                        <span className="shrink-0 text-xs font-semibold text-[var(--emerald-700)]">
                          Selected
                        </span>
                      )}
                    </button>
                  ))}

                  {categorySearch.trim() && !exactCategoryMatch && (
                    <div className="border-t border-[var(--border-soft)] p-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        fullWidth
                        loading={categorySaving}
                        onClick={() => void createCategory()}
                      >
                        Create &ldquo;
                        {categorySearch.trim().replace(/\s+/g, " ")}&rdquo;
                      </Button>
                    </div>
                  )}

                  {filteredCategoryOptions.length === 0 &&
                    !categorySearch.trim() && (
                      <p className="px-3 py-4 text-center text-sm text-[var(--charcoal-500)]">
                        No categories yet. Type a name to create one.
                      </p>
                    )}
                </div>
              )}
            </div>
            <p className="mt-1.5 text-xs text-[var(--charcoal-500)]">
              Search an existing category or type a new one.
            </p>
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Amount (KSh)" required>
              <Input
                type="number"
                min="0.01"
                step="0.01"
                value={form.amount}
                onChange={(event) => updateField("amount", event.target.value)}
                placeholder="0.00"
              />
            </FormField>

            <FormField label="Expense date" required>
              <Input
                type="date"
                value={form.expense_date}
                onChange={(event) =>
                  updateField("expense_date", event.target.value)
                }
              />
            </FormField>
          </div>

          <FormField label="Description" required>
            <Input
              value={form.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
              placeholder="e.g. Electricity bill"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Payment method" required>
              <Select
                value={form.payment_method}
                onChange={(event) =>
                  updateField(
                    "payment_method",
                    event.target.value as PaymentMethod,
                  )
                }
                options={paymentMethodOptions}
              />
            </FormField>

            <FormField label="Paid to" required>
              <Input
                value={form.paid_to}
                onChange={(event) => updateField("paid_to", event.target.value)}
                placeholder="Person or business"
              />
            </FormField>

            <FormField label="Receipt number">
              <Input
                value={form.receipt_number}
                onChange={(event) =>
                  updateField("receipt_number", event.target.value)
                }
                placeholder="Optional"
              />
            </FormField>

            <FormField label="Reference">
              <Input
                value={form.reference}
                onChange={(event) =>
                  updateField("reference", event.target.value)
                }
                placeholder="Optional reference"
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              value={form.notes}
              onChange={(event) => updateField("notes", event.target.value)}
              rows={3}
              className={fieldClass}
              placeholder="Additional notes..."
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={saving || categorySaving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving} disabled={categorySaving}>
              {editingExpense ? "Update expense" : "Create expense"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* PAYMENT MODAL */}
      <Modal
        open={paymentExpense !== null}
        onClose={closePaymentModal}
        title="Mark expense as paid"
        description="Select how this expense was paid."
        size="md"
      >
        <form onSubmit={handlePaymentSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          {paymentExpense && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <InfoCard
                label="Expense"
                value={paymentExpense.expense_number}
              />
              <InfoCard label="Amount" value={ksh(paymentExpense.amount)} />
            </div>
          )}

          <FormField label="Payment method" required>
            <Select
              value={paymentMethod}
              onChange={(event) =>
                setPaymentMethod(event.target.value as PaymentMethod)
              }
              options={paymentMethodOptions}
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
                paymentExpense !== null && actionLoading === paymentExpense.id
              }
            >
              Confirm payment
            </Button>
          </div>
        </form>
      </Modal>

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
        danger
        loading={confirming}
      />
    </div>
  );
}