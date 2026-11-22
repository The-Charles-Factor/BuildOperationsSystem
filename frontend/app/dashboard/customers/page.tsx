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
import { DEFAULT_PAGE_SIZE } from "@/components/ui/Pagination";
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

type Customer = {
  id: number;
  organization: number;
  name: string;
  customer_type: "individual" | "business" | "contractor" | "organization";
  company_name: string | null;
  phone: string;
  alternate_phone: string | null;
  email: string | null;
  tax_pin: string | null;
  status: "active" | "inactive" | "blocked";
  credit_limit: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  addresses?: CustomerAddress[];
};

type CustomerAddress = {
  id: number;
  customer: number;
  address_type: string;
  address_line: string;
  city: string;
  county: string;
  country: string;
  is_default: boolean;
  created_at: string;
};

type CustomerSale = {
  id: number;
  sale_number: string;
  sale_date: string;
  status: "draft" | "completed" | "cancelled" | "returned";
  payment_status: "unpaid" | "partially_paid" | "paid";
  payment_method: string;
  subtotal: string;
  tax_amount: string;
  discount_amount: string;
  total_amount: string;
  amount_paid: string;
  refunded_amount: string;
  net_total: string;
  net_paid: string;
  notes: string | null;
};

type CustomerPurchaseSummary = {
  total_sales: number;
  total_spent: string;
  total_discount: string;
  total_paid: string;
  total_refunded: string;
  net_spent: string;
  outstanding: string;
  last_purchase_date: string | null;
};

type CustomerPurchaseHistory = {
  customer: number;
  summary: CustomerPurchaseSummary;
  sales: CustomerSale[];
};

type CustomerForm = {
  name: string;
  customer_type: Customer["customer_type"];
  company_name: string;
  phone: string;
  alternate_phone: string;
  email: string;
  tax_pin: string;
  status: Customer["status"];
  credit_limit: string;
  notes: string;
};

type AddressForm = {
  customer: string;
  address_type: "billing" | "delivery" | "both";
  address_line: string;
  city: string;
  county: string;
  country: string;
  is_default: boolean;
};

type ConfirmTarget =
  | { kind: "delete_customer"; customer: Customer }
  | { kind: "delete_address"; address: CustomerAddress }
  | null;

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const emptyCustomerForm: CustomerForm = {
  name: "",
  customer_type: "individual",
  company_name: "",
  phone: "",
  alternate_phone: "",
  email: "",
  tax_pin: "",
  status: "active",
  credit_limit: "0",
  notes: "",
};

const emptyAddressForm: AddressForm = {
  customer: "",
  address_type: "both",
  address_line: "",
  city: "",
  county: "",
  country: "Kenya",
  is_default: false,
};

const customerTypeOptions = [
  { value: "individual", label: "Individual" },
  { value: "business", label: "Business" },
  { value: "contractor", label: "Contractor" },
  { value: "organization", label: "Organization" },
];

const customerStatusOptions = [
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "blocked", label: "Blocked" },
];

const typeFilterOptions = [
  { value: "all", label: "All types" },
  ...customerTypeOptions,
];

const statusFilterOptions = [
  { value: "all", label: "All statuses" },
  ...customerStatusOptions,
];

const addressTypeOptions = [
  { value: "billing", label: "Billing" },
  { value: "delivery", label: "Delivery" },
  { value: "both", label: "Billing & delivery" },
];

const fieldClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:min-h-0 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

function ksh(value: string | number | null | undefined) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleString("en-KE", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function typeLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
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

export default function CustomersPage() {
  const token = getToken();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addressSaving, setAddressSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] =
    useState<CustomerForm>(emptyCustomerForm);

  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addressForm, setAddressForm] =
    useState<AddressForm>(emptyAddressForm);

  const [viewCustomerId, setViewCustomerId] = useState<number | null>(null);
  const [purchaseHistory, setPurchaseHistory] = useState<
    Record<number, CustomerPurchaseHistory>
  >({});
  const [purchaseHistoryLoading, setPurchaseHistoryLoading] = useState<
    number | null
  >(null);
  const [purchaseHistoryError, setPurchaseHistoryError] = useState<
    Record<number, string>
  >({});

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

      const [customerData, addressData] = await Promise.all([
        apiFetch<Customer[]>("/api/customers/", { token }),
        apiFetch<CustomerAddress[]>("/api/customer-addresses/", { token }),
      ]);

      setCustomers(customerData);
      setAddresses(addressData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load customers.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  /* ----------------------------- derived ---------------------------- */

  const filteredCustomers = useMemo(() => {
    const query = search.trim().toLowerCase();

    return customers.filter((customer) => {
      const matchesSearch =
        !query ||
        customer.name.toLowerCase().includes(query) ||
        customer.phone.toLowerCase().includes(query) ||
        customer.email?.toLowerCase().includes(query) ||
        customer.company_name?.toLowerCase().includes(query) ||
        customer.tax_pin?.toLowerCase().includes(query);

      const matchesType =
        typeFilter === "all" || customer.customer_type === typeFilter;

      const matchesStatus =
        statusFilter === "all" || customer.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [customers, search, typeFilter, statusFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, typeFilter, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCustomers.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedCustomers = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredCustomers.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredCustomers, page]);

  const activeCount = customers.filter(
    (customer) => customer.status === "active",
  ).length;

  const businessCount = customers.filter(
    (customer) => customer.customer_type !== "individual",
  ).length;

  const blockedCount = customers.filter(
    (customer) => customer.status === "blocked",
  ).length;

  const totalCreditLimit = customers.reduce(
    (sum, customer) => sum + Number(customer.credit_limit || 0),
    0,
  );

  const customerOptions = useMemo(
    () => [
      { value: "", label: "Select customer" },
      ...customers.map((customer) => ({
        value: String(customer.id),
        label: customer.company_name
          ? `${customer.name} — ${customer.company_name}`
          : customer.name,
      })),
    ],
    [customers],
  );

  const viewCustomer =
    viewCustomerId !== null
      ? customers.find((customer) => customer.id === viewCustomerId) || null
      : null;

  function getCustomerAddresses(customerId: number) {
    return addresses.filter((address) => address.customer === customerId);
  }

  function clearFilters() {
    setSearch("");
    setTypeFilter("all");
    setStatusFilter("all");
    setPage(1);
  }

  /* --------------------------- customer form ------------------------ */

  function openCreateCustomer() {
    setEditingCustomer(null);
    setCustomerForm({ ...emptyCustomerForm });
    setShowCustomerForm(true);
    setError("");
  }

  function openEditCustomer(customer: Customer) {
    setEditingCustomer(customer);

    setCustomerForm({
      name: customer.name,
      customer_type: customer.customer_type,
      company_name: customer.company_name || "",
      phone: customer.phone,
      alternate_phone: customer.alternate_phone || "",
      email: customer.email || "",
      tax_pin: customer.tax_pin || "",
      status: customer.status,
      credit_limit: customer.credit_limit || "0",
      notes: customer.notes || "",
    });

    setShowCustomerForm(true);
    setError("");
  }

  function closeCustomerForm() {
    if (saving) return;

    setShowCustomerForm(false);
    setEditingCustomer(null);
    setCustomerForm({ ...emptyCustomerForm });
  }

  function updateCustomerField<K extends keyof CustomerForm>(
    field: K,
    value: CustomerForm[K],
  ) {
    setCustomerForm((current) => ({ ...current, [field]: value }));
  }

  async function handleCustomerSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (!customerForm.name.trim()) {
      setError("Customer name is required.");
      return;
    }

    if (!customerForm.phone.trim()) {
      setError("Phone number is required.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        name: customerForm.name,
        customer_type: customerForm.customer_type,
        company_name: customerForm.company_name || null,
        phone: customerForm.phone,
        alternate_phone: customerForm.alternate_phone.trim(),
        email: customerForm.email || null,
        tax_pin: customerForm.tax_pin || null,
        status: customerForm.status,
        credit_limit: Number(customerForm.credit_limit || 0),
        notes: customerForm.notes.trim(),
      };

      if (editingCustomer) {
        await apiFetch<Customer>(`/api/customers/${editingCustomer.id}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Customer updated successfully.");
      } else {
        await apiFetch<Customer>("/api/customers/", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });

        setSuccessMessage("Customer created successfully.");
      }

      setShowCustomerForm(false);
      setEditingCustomer(null);
      setCustomerForm({ ...emptyCustomerForm });

      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save customer.",
      );
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------- address form ------------------------- */

  function openAddressForm(customerId?: number) {
    setAddressForm({
      ...emptyAddressForm,
      customer: customerId ? String(customerId) : "",
    });

    setShowAddressForm(true);
    setError("");
  }

  function closeAddressForm() {
    if (addressSaving) return;

    setShowAddressForm(false);
    setAddressForm({ ...emptyAddressForm });
  }

  async function handleAddressSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (
      !addressForm.customer ||
      !addressForm.address_line.trim() ||
      !addressForm.city.trim() ||
      !addressForm.county.trim() ||
      !addressForm.country.trim()
    ) {
      setError("Customer, address line, city, county and country are required.");
      return;
    }

    try {
      setAddressSaving(true);
      setError("");

      await apiFetch<CustomerAddress>("/api/customer-addresses/", {
        method: "POST",
        token,
        body: JSON.stringify({
          customer: Number(addressForm.customer),
          address_type: addressForm.address_type,
          address_line: addressForm.address_line,
          city: addressForm.city,
          county: addressForm.county,
          country: addressForm.country,
          is_default: addressForm.is_default,
        }),
      });

      setSuccessMessage("Address added successfully.");
      setShowAddressForm(false);
      setAddressForm({ ...emptyAddressForm });

      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add address.");
    } finally {
      setAddressSaving(false);
    }
  }

  /* --------------------------- confirm dialog ----------------------- */

  async function handleConfirm() {
    if (!confirmTarget) return;

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    try {
      setConfirming(true);
      setError("");

      if (confirmTarget.kind === "delete_customer") {
        await apiFetch(`/api/customers/${confirmTarget.customer.id}/`, {
          method: "DELETE",
          token,
        });

        if (viewCustomerId === confirmTarget.customer.id) {
          setViewCustomerId(null);
        }

        setSuccessMessage("Customer deleted successfully.");
      } else {
        await apiFetch(`/api/customer-addresses/${confirmTarget.address.id}/`, {
          method: "DELETE",
          token,
        });

        setSuccessMessage("Address deleted successfully.");
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

  const confirmCopy =
    confirmTarget?.kind === "delete_customer"
      ? {
          title: "Delete customer?",
          description: `Delete customer "${confirmTarget.customer.name}"? This action cannot be undone.`,
          label: "Delete customer",
          cancel: "Keep customer",
        }
      : {
          title: "Delete address?",
          description: "Delete this address? This action cannot be undone.",
          label: "Delete address",
          cancel: "Keep address",
        };

  /* --------------------------- purchase history --------------------- */

  async function loadPurchaseHistory(customerId: number) {
    if (!token) {
      setPurchaseHistoryError((current) => ({
        ...current,
        [customerId]: "You are not authenticated.",
      }));
      return;
    }

    try {
      setPurchaseHistoryLoading(customerId);
      setPurchaseHistoryError((current) => ({ ...current, [customerId]: "" }));

      const history = await apiFetch<CustomerPurchaseHistory>(
        `/api/customers/${customerId}/purchase-history/`,
        { token },
      );

      setPurchaseHistory((previous) => ({
        ...previous,
        [customerId]: history,
      }));
    } catch (err) {
      setPurchaseHistoryError((current) => ({
        ...current,
        [customerId]:
          err instanceof Error
            ? err.message
            : "Failed to load customer purchase history.",
      }));
    } finally {
      setPurchaseHistoryLoading((current) =>
        current === customerId ? null : current,
      );
    }
  }

  function openCustomerDetails(customerId: number) {
    setViewCustomerId(customerId);

    if (!purchaseHistory[customerId]) {
      void loadPurchaseHistory(customerId);
    }
  }

  /* ----------------------------- columns ---------------------------- */

  const customerColumns: Column<Customer>[] = [
    {
      key: "name",
      label: "Customer",
      render: (customer) => (
        <div className="min-w-0">
          <p className="break-words font-semibold text-[var(--charcoal-900)]">
            {customer.name}
          </p>
          {customer.company_name && (
            <p className="mt-0.5 break-words text-xs text-[var(--charcoal-600)]">
              {customer.company_name}
            </p>
          )}
          {customer.tax_pin && (
            <p className="mt-0.5 font-mono text-xs text-[var(--charcoal-500)]">
              PIN: {customer.tax_pin}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "customer_type",
      label: "Type",
      hideBelow: "md",
      render: (customer) => (
        <span className="whitespace-nowrap text-[var(--charcoal-700)]">
          {typeLabel(customer.customer_type)}
        </span>
      ),
    },
    {
      key: "phone",
      label: "Contact",
      render: (customer) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap text-[var(--charcoal-800)]">
            {customer.phone}
          </p>
          {customer.email && (
            <p className="mt-0.5 break-all text-xs text-[var(--charcoal-500)]">
              {customer.email}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "credit_limit",
      label: "Credit limit",
      hideBelow: "sm",
      render: (customer) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {ksh(customer.credit_limit)}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (customer) => <StatusBadge status={customer.status} />,
    },
    {
      key: "id",
      label: "Actions",
      render: (customer) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openCustomerDetails(customer.id)}
          >
            View
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEditCustomer(customer)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setConfirmTarget({ kind: "delete_customer", customer })}
          >
            <span className="text-red-700">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  /* ------------------------------ render ---------------------------- */

  const modalOpen = showCustomerForm || showAddressForm;
  const history = viewCustomer ? purchaseHistory[viewCustomer.id] : undefined;
  const historyLoading =
    viewCustomer !== null && purchaseHistoryLoading === viewCustomer.id;
  const historyError = viewCustomer
    ? purchaseHistoryError[viewCustomer.id] || ""
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
        title="Customers"
        subtitle="Manage customers, contacts, credit limits and addresses."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Customers" },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={() => openAddressForm()}>
              + Add address
            </Button>
            <Button onClick={openCreateCustomer}>+ Add customer</Button>
          </div>
        }
      />

      {error && !modalOpen && (
        <ErrorState
          title="Customer operation failed"
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
          label="Total customers"
          value={customers.length.toLocaleString()}
          hint="All customer records"
          tone="default"
        />
        <StatCard
          label="Active"
          value={activeCount.toLocaleString()}
          hint={
            blockedCount > 0
              ? `${blockedCount} customer${blockedCount === 1 ? "" : "s"} blocked`
              : "No blocked customers"
          }
          tone={blockedCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Business accounts"
          value={businessCount.toLocaleString()}
          hint="Business, contractor and organization"
          tone="default"
        />
        <StatCard
          label="Credit limits"
          value={ksh(totalCreditLimit)}
          hint="Combined credit extended"
          tone="default"
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Customer records
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Search customers and review their purchase history.
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

        <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 md:grid-cols-[minmax(220px,1fr)_170px_170px_auto]">
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Search name, phone, company, email or PIN..."
          />

          <Select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
            options={typeFilterOptions}
            aria-label="Filter customer type"
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={statusFilterOptions}
            aria-label="Filter customer status"
          />

          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-[var(--charcoal-500)]">
            Showing{" "}
            <span className="font-semibold text-[var(--charcoal-800)]">
              {filteredCustomers.length}
            </span>{" "}
            of {customers.length} customers
          </p>
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingState rows={5} />
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title={
                customers.length === 0
                  ? "No customers yet"
                  : "No matching customers"
              }
              hint={
                customers.length === 0
                  ? "Add a customer to start recording sales against them."
                  : "Try a different search term or clear your filters."
              }
              action={
                customers.length === 0 ? (
                  <Button onClick={openCreateCustomer}>+ Add customer</Button>
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
              columns={customerColumns}
              rows={paginatedCustomers}
              rowKey={(customer) => customer.id}
              emptyMessage="No customers found."
            />
            <Pagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredCustomers.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* DETAILS DRAWER */}
      <Drawer
        open={viewCustomer !== null}
        onClose={() => setViewCustomerId(null)}
        title={viewCustomer ? viewCustomer.name : "Customer"}
        description={viewCustomer?.company_name || undefined}
        width="lg"
      >
        {viewCustomer && (
          <div className="min-w-0 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={viewCustomer.status} />
                <span className="text-xs text-[var(--charcoal-500)]">
                  {typeLabel(viewCustomer.customer_type)}
                </span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openEditCustomer(viewCustomer)}
              >
                Edit customer
              </Button>
            </div>

            <section className="min-w-0">
              <h3 className="mb-3 text-sm font-semibold text-[var(--charcoal-900)]">
                Customer details
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <InfoCard label="Phone" value={viewCustomer.phone} />
                <InfoCard
                  label="Alternate phone"
                  value={viewCustomer.alternate_phone || "—"}
                />
                <InfoCard label="Email" value={viewCustomer.email || "—"} />
                <InfoCard label="Tax PIN" value={viewCustomer.tax_pin || "—"} />
                <InfoCard
                  label="Credit limit"
                  value={ksh(viewCustomer.credit_limit)}
                />
                <InfoCard
                  label="Customer since"
                  value={formatDateTime(viewCustomer.created_at)}
                />
              </div>
              {viewCustomer.notes && (
                <p className="mt-3 break-words rounded-lg border border-[var(--border-soft)] p-3 text-sm text-[var(--charcoal-600)]">
                  {viewCustomer.notes}
                </p>
              )}
            </section>

            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
                  Addresses
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openAddressForm(viewCustomer.id)}
                >
                  + Add address
                </Button>
              </div>

              {getCustomerAddresses(viewCustomer.id).length === 0 ? (
                <p className="rounded-lg border border-[var(--border-soft)] p-4 text-sm text-[var(--charcoal-500)]">
                  No addresses recorded.
                </p>
              ) : (
                <div className="space-y-2">
                  {getCustomerAddresses(viewCustomer.id).map((address) => (
                    <div
                      key={address.id}
                      className="flex min-w-0 items-start justify-between gap-3 rounded-lg border border-[var(--border-soft)] p-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold capitalize text-[var(--charcoal-900)]">
                          {address.address_type}
                          {address.is_default && (
                            <span className="ml-2 text-xs font-medium text-[var(--emerald-700)]">
                              Default
                            </span>
                          )}
                        </p>
                        <p className="mt-1 break-words text-sm text-[var(--charcoal-600)]">
                          {address.address_line}
                        </p>
                        <p className="break-words text-xs text-[var(--charcoal-500)]">
                          {address.city}, {address.county}, {address.country}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setConfirmTarget({ kind: "delete_address", address })
                        }
                      >
                        <span className="text-red-700">Delete</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-sm font-semibold text-[var(--charcoal-900)]">
                    Purchase history
                  </h3>
                  <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
                    Sales, discounts, payments and refunds for this customer.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  loading={historyLoading}
                  onClick={() => void loadPurchaseHistory(viewCustomer.id)}
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
                <div className="space-y-4">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <InfoCard
                      label="Total sales"
                      value={String(history.summary.total_sales)}
                    />
                    <InfoCard
                      label="Net spent"
                      value={ksh(history.summary.net_spent)}
                    />
                    <InfoCard
                      label="Gross sales"
                      value={ksh(history.summary.total_spent)}
                    />
                    <InfoCard
                      label="Discount given"
                      value={ksh(history.summary.total_discount)}
                    />
                    <InfoCard
                      label="Total paid"
                      value={ksh(history.summary.total_paid)}
                    />
                    <InfoCard
                      label="Total refunded"
                      value={ksh(history.summary.total_refunded)}
                    />
                    <InfoCard
                      label="Outstanding"
                      value={ksh(history.summary.outstanding)}
                    />
                    <InfoCard
                      label="Last purchase"
                      value={formatDateTime(history.summary.last_purchase_date)}
                    />
                  </div>

                  {history.sales.length === 0 ? (
                    <p className="rounded-lg border border-[var(--border-soft)] p-4 text-sm text-[var(--charcoal-500)]">
                      No sales have been recorded for this customer yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {history.sales.map((sale) => (
                        <div
                          key={sale.id}
                          className="min-w-0 rounded-lg border border-[var(--border-soft)] p-3"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="break-all font-mono text-sm font-semibold text-[var(--charcoal-900)]">
                                {sale.sale_number}
                              </p>
                              <p className="mt-0.5 text-xs text-[var(--charcoal-500)]">
                                {formatDateTime(sale.sale_date)}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-1.5">
                              <StatusBadge status={sale.status} />
                              <StatusBadge status={sale.payment_status} />
                            </div>
                          </div>
                          <p className="mt-2 break-words text-xs text-[var(--charcoal-500)]">
                            Total {ksh(sale.total_amount)} · Discount{" "}
                            {ksh(sale.discount_amount)} · Refunded{" "}
                            {ksh(sale.refunded_amount)} ·{" "}
                            <span className="font-semibold text-[var(--charcoal-900)]">
                              Net {ksh(sale.net_total)}
                            </span>
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="rounded-lg border border-[var(--border-soft)] p-4 text-sm text-[var(--charcoal-500)]">
                  Purchase history could not be loaded.
                </p>
              )}
            </section>
          </div>
        )}
      </Drawer>

      {/* CUSTOMER MODAL */}
      <Modal
        open={showCustomerForm}
        onClose={closeCustomerForm}
        title={editingCustomer ? "Edit customer" : "Add customer"}
        description="Enter customer contact, credit and status information."
        size="lg"
      >
        <form onSubmit={handleCustomerSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Name" required>
              <Input
                autoFocus
                value={customerForm.name}
                onChange={(event) =>
                  updateCustomerField("name", event.target.value)
                }
                placeholder="John Kamau"
              />
            </FormField>

            <FormField label="Customer type">
              <Select
                value={customerForm.customer_type}
                onChange={(event) =>
                  updateCustomerField(
                    "customer_type",
                    event.target.value as Customer["customer_type"],
                  )
                }
                options={customerTypeOptions}
              />
            </FormField>

            <FormField label="Company name">
              <Input
                value={customerForm.company_name}
                onChange={(event) =>
                  updateCustomerField("company_name", event.target.value)
                }
                placeholder="Company name"
              />
            </FormField>

            <FormField label="Phone" required>
              <Input
                value={customerForm.phone}
                onChange={(event) =>
                  updateCustomerField("phone", event.target.value)
                }
                placeholder="0712345678"
              />
            </FormField>

            <FormField label="Alternate phone">
              <Input
                value={customerForm.alternate_phone}
                onChange={(event) =>
                  updateCustomerField("alternate_phone", event.target.value)
                }
              />
            </FormField>

            <FormField label="Email">
              <Input
                type="email"
                value={customerForm.email}
                onChange={(event) =>
                  updateCustomerField("email", event.target.value)
                }
                placeholder="customer@example.com"
              />
            </FormField>

            <FormField label="Tax PIN">
              <Input
                value={customerForm.tax_pin}
                onChange={(event) =>
                  updateCustomerField("tax_pin", event.target.value)
                }
                placeholder="P000000000A"
              />
            </FormField>

            <FormField label="Status">
              <Select
                value={customerForm.status}
                onChange={(event) =>
                  updateCustomerField(
                    "status",
                    event.target.value as Customer["status"],
                  )
                }
                options={customerStatusOptions}
              />
            </FormField>

            <FormField label="Credit limit (KSh)">
              <Input
                type="number"
                min="0"
                step="0.01"
                value={customerForm.credit_limit}
                onChange={(event) =>
                  updateCustomerField("credit_limit", event.target.value)
                }
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <textarea
              rows={4}
              value={customerForm.notes}
              onChange={(event) =>
                updateCustomerField("notes", event.target.value)
              }
              className={fieldClass}
              placeholder="Additional customer notes..."
            />
          </FormField>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeCustomerForm}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={saving}>
              {editingCustomer ? "Update customer" : "Create customer"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ADDRESS MODAL */}
      <Modal
        open={showAddressForm}
        onClose={closeAddressForm}
        title="Add customer address"
        description="Add a billing or delivery address for a customer."
        size="lg"
      >
        <form onSubmit={handleAddressSubmit} className="min-w-0 space-y-5">
          <ModalError message={error} />

          <FormField label="Customer" required>
            <Select
              value={addressForm.customer}
              onChange={(event) =>
                setAddressForm((current) => ({
                  ...current,
                  customer: event.target.value,
                }))
              }
              options={customerOptions}
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Address type" required>
              <Select
                value={addressForm.address_type}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    address_type: event.target
                      .value as AddressForm["address_type"],
                  }))
                }
                options={addressTypeOptions}
              />
            </FormField>

            <FormField label="Country" required>
              <Input
                value={addressForm.country}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    country: event.target.value,
                  }))
                }
              />
            </FormField>
          </div>

          <FormField label="Address line" required>
            <Input
              value={addressForm.address_line}
              onChange={(event) =>
                setAddressForm((current) => ({
                  ...current,
                  address_line: event.target.value,
                }))
              }
              placeholder="Plot 123, Mombasa Road"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="City" required>
              <Input
                value={addressForm.city}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    city: event.target.value,
                  }))
                }
                placeholder="Nairobi"
              />
            </FormField>

            <FormField label="County" required>
              <Input
                value={addressForm.county}
                onChange={(event) =>
                  setAddressForm((current) => ({
                    ...current,
                    county: event.target.value,
                  }))
                }
                placeholder="Nairobi"
              />
            </FormField>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
            <input
              type="checkbox"
              checked={addressForm.is_default}
              onChange={(event) =>
                setAddressForm((current) => ({
                  ...current,
                  is_default: event.target.checked,
                }))
              }
              className="h-4 w-4 shrink-0 accent-[var(--emerald-600)]"
            />
            <span className="text-sm font-medium text-[var(--charcoal-800)]">
              Set as default address
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeAddressForm}
              disabled={addressSaving}
            >
              Cancel
            </Button>
            <Button type="submit" loading={addressSaving}>
              Add address
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