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
  organization: number;
  name: string;
  company_name: string | null;
  registration_number: string | null;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  tax_pin: string | null;
  payment_terms: "cash" | "credit_7" | "credit_14" | "credit_30" | "credit_60";
  credit_limit: string;
  status: "active" | "inactive" | "blacklisted";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SupplierForm = {
  name: string;
  company_name: string;
  registration_number: string;
  phone: string;
  alternate_phone: string;
  email: string;
  address: string;
  city: string;
  country: string;
  tax_pin: string;
  payment_terms: Supplier["payment_terms"];
  credit_limit: string;
  status: Supplier["status"];
  notes: string;
};

type SupplierPurchase = {
  id: number;
  purchase_number: string;
  purchase_date: string;
  expected_delivery_date: string | null;
  status: "draft" | "ordered" | "partially_received" | "received" | "cancelled";
  payment_status: "unpaid" | "partially_paid" | "paid";
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  paid: string;
  outstanding: string;
  notes: string;
  created_at: string;
};

type SupplierPurchaseSummary = {
  total_purchases: number;
  total_purchase_value: string;
  total_paid: string;
  outstanding: string;
  last_purchase_date: string | null;
};

type SupplierPurchaseHistory = {
  supplier: number;
  summary: SupplierPurchaseSummary;
  purchases: SupplierPurchase[];
};

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const emptyForm: SupplierForm = {
  name: "",
  company_name: "",
  registration_number: "",
  phone: "",
  alternate_phone: "",
  email: "",
  address: "",
  city: "",
  country: "Kenya",
  tax_pin: "",
  payment_terms: "cash",
  credit_limit: "0",
  status: "active",
  notes: "",
};

const paymentTermsOptions = [
  { value: "cash", label: "Cash" },
  { value: "credit_7", label: "7 days" },
  { value: "credit_14", label: "14 days" },
  { value: "credit_30", label: "30 days" },
  { value: "credit_60", label: "60 days" },
];

const supplierStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blacklisted", label: "Blacklisted" },
];

const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...supplierStatusOptions,
];

const fieldClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:min-h-0 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

function paymentTermsLabel(terms: Supplier["payment_terms"]) {
  return (
    paymentTermsOptions.find((option) => option.value === terms)?.label ||
    terms
  );
}

function ksh(value: string | number | null | undefined) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-KE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="min-w-0">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
          {title}
        </h3>
        <p className="mt-1 text-xs text-[var(--charcoal-500)]">
          {description}
        </p>
      </div>
      {children}
    </section>
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
      <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[var(--charcoal-900)]">
        {value}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function SuppliersPage() {
  const token = getToken();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<Supplier | null>(null);

  const [viewSupplierId, setViewSupplierId] = useState<number | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<
    Record<number, SupplierPurchaseHistory>
  >({});
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState<
    number | null
  >(null);
  const [purchaseHistoryError, setPurchaseHistoryError] = useState<
    Record<number, string>
  >({});

  /* ----------------------------- toast ------------------------------ */

  useEffect(() => {
    if (!successMessage) return;

    const timer = window.setTimeout(() => setSuccessMessage(""), 4000);

    return () => window.clearTimeout(timer);
  }, [successMessage]);

  /* ----------------------------- loading ---------------------------- */

  const loadSuppliers = useCallback(async () => {
    if (!token) {
      setError("You are not authenticated. Please sign in again.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const data = await apiFetch<Supplier[]>("/api/suppliers/", { token });

      setSuppliers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load suppliers.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadSuppliers();
  }, [loadSuppliers]);

  async function loadPurchaseHistory(supplierId: number) {
    if (!token) {
      setPurchaseHistoryError((current) => ({
        ...current,
        [supplierId]: "You are not authenticated.",
      }));
      return;
    }

    try {
      setPurchaseHistoryLoading(supplierId);
      setPurchaseHistoryError((current) => ({ ...current, [supplierId]: "" }));

      const data = await apiFetch<SupplierPurchaseHistory>(
        `/api/suppliers/${supplierId}/purchase-history/`,
        { token },
      );

      setPurchaseHistory((current) => ({ ...current, [supplierId]: data }));
    } catch (err) {
      setPurchaseHistoryError((current) => ({
        ...current,
        [supplierId]:
          err instanceof Error
            ? err.message
            : "Purchase history could not be loaded.",
      }));
    } finally {
      setPurchaseHistoryLoading((current) =>
        current === supplierId ? null : current,
      );
    }
  }

  function openSupplierDetails(supplierId: number) {
    setViewSupplierId(supplierId);

    if (!purchaseHistory[supplierId]) {
      void loadPurchaseHistory(supplierId);
    }
  }

  /* ----------------------------- derived ---------------------------- */

  const filteredSuppliers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return suppliers.filter((supplier) => {
      const matchesSearch =
        !query ||
        supplier.name.toLowerCase().includes(query) ||
        (supplier.company_name || "").toLowerCase().includes(query) ||
        supplier.phone.toLowerCase().includes(query) ||
        (supplier.email || "").toLowerCase().includes(query) ||
        (supplier.tax_pin || "").toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === "all" || supplier.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [suppliers, search, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredSuppliers.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedSuppliers = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredSuppliers.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredSuppliers, page]);

  const stats = useMemo(() => {
    const count = (status: Supplier["status"]) =>
      suppliers.filter((supplier) => supplier.status === status).length;

    return {
      total: suppliers.length,
      active: count("active"),
      inactive: count("inactive"),
      blacklisted: count("blacklisted"),
      totalCredit: suppliers.reduce(
        (sum, supplier) => sum + Number(supplier.credit_limit || 0),
        0,
      ),
    };
  }, [suppliers]);

  const viewSupplier =
    viewSupplierId !== null
      ? suppliers.find((supplier) => supplier.id === viewSupplierId) || null
      : null;

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  }

  /* ------------------------------ form ------------------------------ */

  function updateField<K extends keyof SupplierForm>(
    field: K,
    value: SupplierForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function openCreateModal() {
    setEditingSupplier(null);
    setForm(emptyForm);
    setError("");
    setShowModal(true);
  }

  function openEditModal(supplier: Supplier) {
    setEditingSupplier(supplier);

    setForm({
      name: supplier.name,
      company_name: supplier.company_name || "",
      registration_number: supplier.registration_number || "",
      phone: supplier.phone,
      alternate_phone: supplier.alternate_phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
      city: supplier.city || "",
      country: supplier.country || "Kenya",
      tax_pin: supplier.tax_pin || "",
      payment_terms: supplier.payment_terms,
      credit_limit: supplier.credit_limit || "0",
      status: supplier.status,
      notes: supplier.notes || "",
    });

    setError("");
    setShowModal(true);
  }

  function closeModal() {
    if (saving) return;
    setShowModal(false);
    setEditingSupplier(null);
    setForm(emptyForm);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (!form.name.trim()) {
      setError("Supplier name is required.");
      return;
    }

    if (!form.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: form.name.trim(),
        company_name: form.company_name.trim() || null,
        registration_number: form.registration_number.trim() || null,
        phone: form.phone.trim(),
        alternate_phone: form.alternate_phone.trim() || null,
        email: form.email.trim() || null,
        address: form.address.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        tax_pin: form.tax_pin.trim() || null,
        payment_terms: form.payment_terms,
        credit_limit: form.credit_limit || "0",
        status: form.status,
        notes: form.notes.trim() || null,
      };

      if (editingSupplier) {
        await apiFetch<Supplier>(`/api/suppliers/${editingSupplier.id}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Supplier updated successfully.");
      } else {
        await apiFetch<Supplier>("/api/suppliers/", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Supplier created successfully.");
      }

      setShowModal(false);
      setEditingSupplier(null);
      setForm(emptyForm);

      await loadSuppliers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save supplier.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    try {
      setDeleting(true);
      setError("");

      await apiFetch<void>(`/api/suppliers/${deleteTarget.id}/`, {
        method: "DELETE",
        token,
      });

      if (viewSupplierId === deleteTarget.id) {
        setViewSupplierId(null);
      }

      setSuccessMessage("Supplier deleted successfully.");
      setDeleteTarget(null);

      await loadSuppliers();
    } catch (err) {
      setDeleteTarget(null);
      setError(
        err instanceof Error ? err.message : "Failed to delete supplier.",
      );
    } finally {
      setDeleting(false);
    }
  }

  /* ----------------------------- columns ---------------------------- */

  const supplierColumns: Column<Supplier>[] = [
    {
      key: "name",
      label: "Supplier",
      render: (supplier) => (
        <div className="min-w-0">
          <p className="break-words font-semibold text-[var(--charcoal-900)]">
            {supplier.name}
          </p>
          {supplier.company_name && (
            <p className="mt-0.5 break-words text-xs text-[var(--charcoal-600)]">
              {supplier.company_name}
            </p>
          )}
          {supplier.registration_number && (
            <p className="mt-0.5 break-all text-xs text-[var(--charcoal-500)]">
              Reg: {supplier.registration_number}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "phone",
      label: "Contact",
      render: (supplier) => (
        <div className="min-w-0">
          <p className="break-all text-[var(--charcoal-800)]">{supplier.phone}</p>
          {supplier.email && (
            <p className="mt-0.5 break-all text-xs text-[var(--charcoal-500)]">
              {supplier.email}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "city",
      label: "Location",
      hideBelow: "lg",
      render: (supplier) => (
        <div className="min-w-0">
          <p className="break-words text-[var(--charcoal-800)]">
            {supplier.city || "—"}
          </p>
          <p className="mt-0.5 break-words text-xs text-[var(--charcoal-500)]">
            {supplier.country || "—"}
          </p>
        </div>
      ),
    },
    {
      key: "payment_terms",
      label: "Payment terms",
      hideBelow: "md",
      render: (supplier) => (
        <span className="text-[var(--charcoal-700)]">
          {paymentTermsLabel(supplier.payment_terms)}
        </span>
      ),
    },
    {
      key: "credit_limit",
      label: "Credit limit",
      align: "right",
      render: (supplier) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {ksh(supplier.credit_limit)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (supplier) => <StatusBadge status={supplier.status} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (supplier) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openSupplierDetails(supplier.id)}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEditModal(supplier)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleteTarget(supplier)}
          >
            <span className="text-red-700">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  /* ------------------------------ render ---------------------------- */

  const history = viewSupplier ? purchaseHistory[viewSupplier.id] : undefined;
  const historyLoading =
    viewSupplier !== null && purchaseHistoryLoading === viewSupplier.id;
  const historyError = viewSupplier
    ? purchaseHistoryError[viewSupplier.id] || ""
    : "";

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <Toast
        open={Boolean(successMessage)}
        message={successMessage}
        tone="success"
        onClose={() => setSuccessMessage("")}
      />

      <PageHeader
        title="Suppliers"
        subtitle="Manage suppliers, payment terms, credit limits and purchasing relationships."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Suppliers" },
        ]}
        action={<Button onClick={openCreateModal}>+ Add supplier</Button>}
      />

      {error && !showModal && (
        <ErrorState
          title="Supplier operation failed"
          message={error}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadSuppliers()}
            >
              Retry loading
            </Button>
          }
        />
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
        <StatCard
          label="Total suppliers"
          value={stats.total.toLocaleString()}
          hint="All supplier records"
          tone="default"
        />
        <StatCard
          label="Active"
          value={stats.active.toLocaleString()}
          hint="Available for purchasing"
          tone="default"
        />
        <StatCard
          label="Inactive"
          value={stats.inactive.toLocaleString()}
          hint="Not currently used"
          tone="default"
        />
        <StatCard
          label="Blacklisted"
          value={stats.blacklisted.toLocaleString()}
          hint="Should not be ordered from"
          tone={stats.blacklisted > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Total credit limit"
          value={ksh(stats.totalCredit)}
          hint="Combined supplier credit"
          tone="default"
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Supplier records
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Search suppliers and review their purchase history.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void loadSuppliers()}
              loading={loading}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 md:grid-cols-[minmax(220px,1fr)_190px_auto]">
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Search supplier, company, phone, email or PIN..."
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={statusFilterOptions}
            aria-label="Filter supplier status"
          />

          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-[var(--charcoal-500)]">
            Showing{" "}
            <span className="font-semibold text-[var(--charcoal-800)]">
              {filteredSuppliers.length}
            </span>{" "}
            of {suppliers.length} suppliers
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingState rows={5} />
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title={
                suppliers.length === 0
                  ? "No suppliers yet"
                  : "No matching suppliers"
              }
              hint={
                suppliers.length === 0
                  ? "Add a supplier to start ordering stock."
                  : "Try a different search term or clear your filters."
              }
              action={
                suppliers.length === 0 ? (
                  <Button onClick={openCreateModal}>+ Add supplier</Button>
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
              columns={supplierColumns}
              rows={paginatedSuppliers}
              rowKey={(supplier) => supplier.id}
              emptyMessage="No suppliers found."
            />
            <Pagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredSuppliers.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* DETAILS DRAWER */}
      <Drawer
        open={viewSupplier !== null}
        onClose={() => setViewSupplierId(null)}
        title={viewSupplier ? viewSupplier.name : "Supplier"}
        description={viewSupplier?.company_name || undefined}
        width="lg"
      >
        {viewSupplier && (
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StatusBadge status={viewSupplier.status} />
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditModal(viewSupplier)}
              >
                Edit supplier
              </Button>
            </div>

            <section className="min-w-0">
              <h3 className="mb-3 text-sm font-semibold text-[var(--charcoal-900)]">
                Supplier details
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard label="Phone" value={viewSupplier.phone || "—"} />
                <InfoCard
                  label="Alternate phone"
                  value={viewSupplier.alternate_phone || "—"}
                />
                <InfoCard label="Email" value={viewSupplier.email || "—"} />
                <InfoCard label="Tax PIN" value={viewSupplier.tax_pin || "—"} />
                <InfoCard
                  label="Registration"
                  value={viewSupplier.registration_number || "—"}
                />
                <InfoCard
                  label="Payment terms"
                  value={paymentTermsLabel(viewSupplier.payment_terms)}
                />
                <InfoCard
                  label="Credit limit"
                  value={ksh(viewSupplier.credit_limit)}
                />
                <InfoCard
                  label="Location"
                  value={
                    [viewSupplier.city, viewSupplier.country]
                      .filter(Boolean)
                      .join(", ") || "—"
                  }
                />
              </div>
              {viewSupplier.address && (
                <p className="mt-3 break-words rounded-lg border border-[var(--border-soft)] p-3 text-sm text-[var(--charcoal-600)]">
                  {viewSupplier.address}
                </p>
              )}
              {viewSupplier.notes && (
                <p className="mt-3 whitespace-pre-wrap break-words rounded-lg border border-[var(--border-soft)] p-3 text-sm text-[var(--charcoal-600)]">
                  {viewSupplier.notes}
                </p>
              )}
            </section>

            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
                    Purchase relationship
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
                    Purchasing activity recorded against this supplier.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={historyLoading}
                  onClick={() => void loadPurchaseHistory(viewSupplier.id)}
                >
                  Reload
                </Button>
              </div>

              {historyLoading && !history ? (
                <LoadingState rows={2} />
              ) : historyError && !history ? (
                <p className="break-words rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {historyError}
                </p>
              ) : history ? (
                <div className="min-w-0 space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoCard
                      label="Total purchases"
                      value={String(history.summary.total_purchases)}
                    />
                    <InfoCard
                      label="Purchase value"
                      value={ksh(history.summary.total_purchase_value)}
                    />
                    <InfoCard
                      label="Total paid"
                      value={ksh(history.summary.total_paid)}
                    />
                    <InfoCard
                      label="Outstanding"
                      value={ksh(history.summary.outstanding)}
                    />
                    <InfoCard
                      label="Last purchase"
                      value={
                        history.summary.last_purchase_date
                          ? formatDate(history.summary.last_purchase_date)
                          : "No purchases recorded"
                      }
                    />
                  </div>

                  {history.purchases.length === 0 ? (
                    <p className="rounded-lg border border-[var(--border-soft)] p-4 text-sm text-[var(--charcoal-500)]">
                      No purchasing activity has been recorded for this
                      supplier yet.
                    </p>
                  ) : (
                    <div className="min-w-0 space-y-2">
                      {history.purchases.map((purchase) => (
                        <div
                          key={purchase.id}
                          className="min-w-0 rounded-lg border border-[var(--border-soft)] p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                              <p className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
                                {purchase.purchase_number}
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
                                {formatDate(purchase.purchase_date)}
                              </p>
                              {purchase.notes && (
                                <p className="mt-1 break-words text-xs text-[var(--charcoal-500)]">
                                  {purchase.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-1.5 sm:justify-end">
                              <StatusBadge status={purchase.status} />
                              <StatusBadge status={purchase.payment_status} />
                            </div>
                          </div>
                          <p className="mt-2 break-words text-xs tabular-nums text-[var(--charcoal-500)]">
                            Total {ksh(purchase.total_amount)} · Discount{" "}
                            {ksh(purchase.discount_amount)} · Paid{" "}
                            {ksh(purchase.paid)} ·{" "}
                            <span
                              className={
                                Number(purchase.outstanding || 0) > 0
                                  ? "font-semibold text-amber-700"
                                  : "font-semibold text-[var(--charcoal-900)]"
                              }
                            >
                              Outstanding {ksh(purchase.outstanding)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-[var(--border-soft)] p-4 text-sm text-[var(--charcoal-500)]">
                  No purchase history loaded.
                </p>
              )}
            </section>

            <p className="border-t border-[var(--border-soft)] pt-4 text-xs text-[var(--charcoal-500)]">
              Supplier record created {formatDateTime(viewSupplier.created_at)}.
            </p>
          </div>
        )}
      </Drawer>

      {/* SUPPLIER MODAL */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingSupplier ? "Edit supplier" : "Add supplier"}
        description="Enter the supplier's business and payment information."
        size="xl"
      >
        <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
          <ModalError message={error} />

          <FormSection
            title="Basic information"
            description="Identify the supplier in your records."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Supplier name" required>
                <Input
                  value={form.name}
                  onChange={(event) => updateField("name", event.target.value)}
                  placeholder="e.g. ABC Hardware Supplies"
                />
              </FormField>

              <FormField label="Company name">
                <Input
                  value={form.company_name}
                  onChange={(event) =>
                    updateField("company_name", event.target.value)
                  }
                  placeholder="Registered company name"
                />
              </FormField>

              <FormField label="Registration number">
                <Input
                  value={form.registration_number}
                  onChange={(event) =>
                    updateField("registration_number", event.target.value)
                  }
                  placeholder="Company registration number"
                />
              </FormField>

              <FormField label="Tax PIN">
                <Input
                  value={form.tax_pin}
                  onChange={(event) =>
                    updateField("tax_pin", event.target.value)
                  }
                  placeholder="KRA PIN"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Contact information"
            description="How to reach the supplier and where they are based."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Phone" required>
                <Input
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  placeholder="e.g. 0712345678"
                />
              </FormField>

              <FormField label="Alternate phone">
                <Input
                  value={form.alternate_phone}
                  onChange={(event) =>
                    updateField("alternate_phone", event.target.value)
                  }
                  placeholder="Alternative phone number"
                />
              </FormField>

              <FormField label="Email">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  placeholder="supplier@example.com"
                />
              </FormField>

              <FormField label="City">
                <Input
                  value={form.city}
                  onChange={(event) => updateField("city", event.target.value)}
                  placeholder="e.g. Nairobi"
                />
              </FormField>

              <FormField label="Country">
                <Input
                  value={form.country}
                  onChange={(event) =>
                    updateField("country", event.target.value)
                  }
                  placeholder="Kenya"
                />
              </FormField>

              <FormField label="Address">
                <Input
                  value={form.address}
                  onChange={(event) =>
                    updateField("address", event.target.value)
                  }
                  placeholder="Physical or postal address"
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Payment and credit"
            description="Agreed payment terms and credit extended by this supplier."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="Payment terms">
                <Select
                  value={form.payment_terms}
                  onChange={(event) =>
                    updateField(
                      "payment_terms",
                      event.target.value as Supplier["payment_terms"],
                    )
                  }
                  options={paymentTermsOptions}
                />
              </FormField>

              <FormField label="Credit limit (KSh)">
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.credit_limit}
                  onChange={(event) =>
                    updateField("credit_limit", event.target.value)
                  }
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Status and notes"
            description="Whether the supplier can currently be ordered from."
          >
            <div className="space-y-4">
              <FormField label="Status">
                <Select
                  value={form.status}
                  onChange={(event) =>
                    updateField(
                      "status",
                      event.target.value as Supplier["status"],
                    )
                  }
                  options={supplierStatusOptions}
                />
              </FormField>

              <FormField label="Notes">
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={4}
                  className={fieldClass}
                  placeholder="Additional supplier notes..."
                />
              </FormField>
            </div>
          </FormSection>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeModal}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingSupplier ? "Update supplier" : "Create supplier"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION */}
      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDelete()}
        title="Delete supplier?"
        description={
          deleteTarget
            ? `Delete supplier "${deleteTarget.name}"? This action cannot be undone.`
            : "This action cannot be undone."
        }
        confirmLabel="Delete supplier"
        cancelLabel="Keep supplier"
        danger
        loading={deleting}
      />
    </div>
  );
}