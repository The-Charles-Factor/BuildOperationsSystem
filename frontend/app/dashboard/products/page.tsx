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

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */

type MeResponse = {
  role?: string | null;
  can_view_totals?: boolean;
};

type Product = {
  id: number;
  organization_id: number;
  sku: string;
  name: string;
  description: string | null;
  category_id: number | null;
  category_name?: string | null;
  brand_id: number | null;
  brand_name?: string | null;
  cost_price: string;
  selling_price: string;
  unit: string;
  tax_rate: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type Category = { id: number; name: string };
type Brand = { id: number; name: string };

type ProductForm = {
  sku: string;
  name: string;
  description: string;
  category_id: string;
  brand_id: string;
  cost_price: string;
  selling_price: string;
  unit: string;
  tax_rate: string;
  is_active: boolean;
};

/* ------------------------------------------------------------------ */
/* Constants & helpers                                                 */
/* ------------------------------------------------------------------ */

const UNITS = [
  { value: "piece", label: "Piece" },
  { value: "box", label: "Box" },
  { value: "set", label: "Set" },
  { value: "pair", label: "Pair" },
  { value: "meter", label: "Meter" },
  { value: "kg", label: "Kilogram" },
  { value: "liter", label: "Liter" },
  { value: "roll", label: "Roll" },
  { value: "pack", label: "Pack" },
  { value: "bag", label: "Bag" },
];

const statusOptions = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
];

const EMPTY_FORM: ProductForm = {
  sku: "",
  name: "",
  description: "",
  category_id: "",
  brand_id: "",
  cost_price: "",
  selling_price: "",
  unit: "piece",
  tax_rate: "16",
  is_active: true,
};

const fieldClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:min-h-0 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

function money(value: string | number | null | undefined) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

function Notice({
  message,
  onDismiss,
}: {
  message: string;
  onDismiss?: () => void;
}) {
  if (!message) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
      <span className="min-w-0 break-words">{message}</span>
      {onDismiss && (
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      )}
    </div>
  );
}

function RelationshipField({
  label,
  value,
  options,
  placeholder,
  onChange,
  showCreate,
  newValue,
  onNewValueChange,
  onCreate,
  onCancelCreate,
  onOpenCreate,
  saving,
  required = false,
}: {
  label: string;
  value: string;
  options: Array<{ id: number; name: string }>;
  placeholder: string;
  onChange: (value: string) => void;
  showCreate: boolean;
  newValue: string;
  onNewValueChange: (value: string) => void;
  onCreate: () => void;
  onCancelCreate: () => void;
  onOpenCreate: () => void;
  saving: boolean;
  required?: boolean;
}) {
  return (
    <div className="min-w-0">
      <label className={labelClass}>
        {label}
        {required && <span className="ml-1 text-red-600">*</span>}
      </label>

      <div className="flex items-start gap-2">
        <select
          value={value}
          required={required}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldClass} min-w-0 flex-1`}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>

        <div className="mt-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onOpenCreate}
          >
            + New
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="mt-3 min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
          <p className="text-xs font-medium text-[var(--charcoal-700)]">
            Create a new {label.toLowerCase()}
          </p>
          <input
            type="text"
            value={newValue}
            onChange={(event) => onNewValueChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onCreate();
              }
              if (event.key === "Escape") onCancelCreate();
            }}
            placeholder={`${label} name`}
            autoFocus
            className={fieldClass}
          />
          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onCancelCreate}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onCreate}
              loading={saving}
              disabled={!newValue.trim()}
            >
              Create
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function ProductsPage() {
  const token = getToken();

  const [canViewTotals, setCanViewTotals] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);

  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [newBrandName, setNewBrandName] = useState("");

  const [savingCategory, setSavingCategory] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [deleting, setDeleting] = useState(false);

  /* ----------------------------- loading ---------------------------- */

  const loadProducts = useCallback(async () => {
    if (!token) {
      setError("You are not authenticated. Please sign in again.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      const [meData, data] = await Promise.all([
        apiFetch<MeResponse>("/api/accounts/me/", { token }).catch(() => null),
        apiFetch<Product[]>("/api/products/", { token }),
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

      setProducts(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load products.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadCategoriesAndBrands = useCallback(async () => {
    if (!token) return;

    try {
      const [categoryData, brandData] = await Promise.all([
        apiFetch<Category[] | { results: Category[] }>("/api/categories/", {
          token,
        }),
        apiFetch<Brand[] | { results: Brand[] }>("/api/brands/", { token }),
      ]);

      setCategories(
        Array.isArray(categoryData) ? categoryData : categoryData.results,
      );
      setBrands(Array.isArray(brandData) ? brandData : brandData.results);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load categories and brands.",
      );
    }
  }, [token]);

  useEffect(() => {
    void Promise.all([loadProducts(), loadCategoriesAndBrands()]);
  }, [loadProducts, loadCategoriesAndBrands]);

  async function refreshData() {
    setRefreshing(true);
    await Promise.all([loadProducts(), loadCategoriesAndBrands()]);
    setRefreshing(false);
  }

  /* ----------------------------- derived ---------------------------- */

  const categoryMap = useMemo(
    () => new Map(categories.map((item) => [item.id, item.name])),
    [categories],
  );

  const brandMap = useMemo(
    () => new Map(brands.map((item) => [item.id, item.name])),
    [brands],
  );

  const filteredProducts = useMemo(() => {
    const query = search.toLowerCase().trim();

    return products.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku.toLowerCase().includes(query) ||
        (product.brand_name || "").toLowerCase().includes(query) ||
        (product.category_name || "").toLowerCase().includes(query);

      const matchesStatus =
        activeFilter === "all" ||
        (activeFilter === "active" && product.is_active) ||
        (activeFilter === "inactive" && !product.is_active);

      return matchesSearch && matchesStatus;
    });
  }, [products, search, activeFilter]);

  useEffect(() => {
    setPage(1);
  }, [search, activeFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredProducts.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredProducts.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredProducts, page]);

  const stats = useMemo(() => {
    const active = products.filter((item) => item.is_active).length;
    const inactive = products.length - active;
    const categoriesUsed = new Set(
      products.map((item) => item.category_id).filter(Boolean),
    ).size;

    return { total: products.length, active, inactive, categoriesUsed };
  }, [products]);

  function clearFilters() {
    setSearch("");
    setActiveFilter("all");
    setPage(1);
  }

  /* ------------------------------ form ------------------------------ */

  function openCreateForm() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowNewCategory(false);
    setShowNewBrand(false);
    setNewCategoryName("");
    setNewBrandName("");
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function openEditForm(product: Product) {
    setEditingId(product.id);
    setForm({
      sku: product.sku,
      name: product.name,
      description: product.description || "",
      category_id: product.category_id?.toString() || "",
      brand_id: product.brand_id?.toString() || "",
      cost_price: product.cost_price,
      selling_price: product.selling_price,
      unit: product.unit,
      tax_rate: product.tax_rate,
      is_active: product.is_active,
    });
    setShowNewCategory(false);
    setShowNewBrand(false);
    setNewCategoryName("");
    setNewBrandName("");
    setError("");
    setNotice("");
    setShowForm(true);
  }

  function closeForm() {
    if (saving || savingCategory || savingBrand) return;
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowNewCategory(false);
    setShowNewBrand(false);
  }

  async function createCategory() {
    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    const name = newCategoryName.trim();
    if (!name) {
      setError("Enter a category name.");
      return;
    }

    try {
      setSavingCategory(true);
      setError("");

      const category = await apiFetch<Category>("/api/categories/", {
        method: "POST",
        token,
        body: JSON.stringify({ name }),
      });

      setCategories((current) =>
        [...current, category].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setForm((current) => ({
        ...current,
        category_id: String(category.id),
      }));
      setNewCategoryName("");
      setShowNewCategory(false);
      setNotice("Category created and selected.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create category.",
      );
    } finally {
      setSavingCategory(false);
    }
  }

  async function createBrand() {
    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    const name = newBrandName.trim();
    if (!name) {
      setError("Enter a brand name.");
      return;
    }

    try {
      setSavingBrand(true);
      setError("");

      const brand = await apiFetch<Brand>("/api/brands/", {
        method: "POST",
        token,
        body: JSON.stringify({ name }),
      });

      setBrands((current) =>
        [...current, brand].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setForm((current) => ({
        ...current,
        brand_id: String(brand.id),
      }));
      setNewBrandName("");
      setShowNewBrand(false);
      setNotice("Brand created and selected.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create brand.",
      );
    } finally {
      setSavingBrand(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    if (!form.category_id) {
      setError("Please select or create a category.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload: Record<string, unknown> = {
        sku: form.sku.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        category_id: Number(form.category_id),
        brand_id: form.brand_id ? Number(form.brand_id) : null,
        selling_price: form.selling_price,
        unit: form.unit,
        tax_rate: form.tax_rate,
        is_active: form.is_active,
      };

      if (canViewTotals && form.cost_price !== "") {
        payload.cost_price = form.cost_price;
      }

      if (editingId !== null) {
        await apiFetch<Product>(`/api/products/${editingId}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
        setNotice("Product updated successfully.");
      } else {
        await apiFetch<Product>("/api/products/", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        setNotice("Product created successfully.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      await loadProducts();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save product.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) {
      if (!token) setError("You are not authenticated.");
      return;
    }

    try {
      setDeleting(true);
      setError("");

      await apiFetch(`/api/products/${deleteTarget.id}/`, {
        method: "DELETE",
        token,
      });

      setProducts((current) =>
        current.filter((item) => item.id !== deleteTarget.id),
      );
      setNotice(`"${deleteTarget.name}" was deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to delete product.",
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  }

  /* ----------------------------- columns ---------------------------- */

  const productColumns: Column<Product>[] = useMemo(() => {
    const baseColumns: Column<Product>[] = [
      {
        key: "name",
        label: "Product",
        render: (product) => (
          <div className="min-w-0">
            <p className="break-words font-semibold text-[var(--charcoal-900)]">
              {product.name}
            </p>
            <p className="mt-0.5 break-all font-mono text-xs text-[var(--charcoal-500)]">
              {product.sku}
            </p>
            {product.description && (
              <p className="mt-1 max-w-xs truncate text-xs text-[var(--charcoal-500)]">
                {product.description}
              </p>
            )}
          </div>
        ),
      },
      {
        key: "category_id",
        label: "Category / Brand",
        render: (product) => {
          const category =
            product.category_name ||
            (product.category_id ? categoryMap.get(product.category_id) : null);
          const brand =
            product.brand_name ||
            (product.brand_id ? brandMap.get(product.brand_id) : null);

          return (
            <div className="min-w-0">
              <p className="break-words text-[var(--charcoal-800)]">
                {category || "Uncategorised"}
              </p>
              <p className="mt-0.5 break-words text-xs text-[var(--charcoal-500)]">
                {brand || "No brand"}
              </p>
            </div>
          );
        },
      },
      {
        key: "unit",
        label: "Unit",
        hideBelow: "md",
        render: (product) => (
          <span className="whitespace-nowrap capitalize text-[var(--charcoal-700)]">
            {product.unit}
          </span>
        ),
      },
    ];

    if (canViewTotals) {
      baseColumns.push({
        key: "cost_price",
        label: "Cost price",
        hideBelow: "lg",
        render: (product) => (
          <span className="whitespace-nowrap tabular-nums text-[var(--charcoal-700)]">
            {money(product.cost_price)}
          </span>
        ),
      });
    }

    baseColumns.push(
      {
        key: "selling_price",
        label: "Selling price",
        render: (product) => (
          <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
            {money(product.selling_price)}
          </span>
        ),
      },
      {
        key: "tax_rate",
        label: "Tax",
        hideBelow: "lg",
        render: (product) => (
          <span className="whitespace-nowrap tabular-nums text-[var(--charcoal-700)]">
            {Number(product.tax_rate)}%
          </span>
        ),
      },
      {
        key: "is_active",
        label: "Status",
        hideBelow: "sm",
        render: (product) => (
          <StatusBadge status={product.is_active ? "active" : "inactive"} />
        ),
      },
      {
        key: "id",
        label: "Actions",
        render: (product) => (
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => openEditForm(product)}
            >
              Edit
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setDeleteTarget(product)}
            >
              <span className="text-red-700">Delete</span>
            </Button>
          </div>
        ),
      },
    );

    return baseColumns;
  }, [canViewTotals, categoryMap, brandMap]);

  /* ------------------------------ render ---------------------------- */

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Products"
        subtitle="Manage product details, pricing, categories, brands and catalogue availability."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Products" },
        ]}
        action={<Button onClick={openCreateForm}>+ Add product</Button>}
      />

      {error && !showForm && (
        <ErrorState
          title="Product operation failed"
          message={error}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void refreshData()}
            >
              Retry loading
            </Button>
          }
        />
      )}

      {notice && !showForm && (
        <Notice message={notice} onDismiss={() => setNotice("")} />
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
        <StatCard
          label="Total products"
          value={loading ? "—" : stats.total.toLocaleString()}
          hint="All catalogue entries"
          tone="default"
        />
        <StatCard
          label="Active products"
          value={loading ? "—" : stats.active.toLocaleString()}
          hint="Available in the catalogue"
          tone="default"
        />
        <StatCard
          label="Categories used"
          value={loading ? "—" : stats.categoriesUsed.toLocaleString()}
          hint={`${categories.length} categories configured`}
          tone="default"
        />
        <StatCard
          label="Inactive products"
          value={loading ? "—" : stats.inactive.toLocaleString()}
          hint="Not currently active"
          tone={stats.inactive > 0 ? "warning" : "default"}
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Product records
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Search and manage your product records.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => void refreshData()}
              loading={refreshing}
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
            placeholder="Search name, SKU, brand or category..."
          />

          <Select
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
            options={statusOptions}
            aria-label="Filter product status"
          />

          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
          <p className="text-sm text-[var(--charcoal-500)]">
            Showing{" "}
            <span className="font-semibold text-[var(--charcoal-800)]">
              {filteredProducts.length}
            </span>{" "}
            of {products.length} products
          </p>
          <span className="text-xs text-[var(--charcoal-500)]">
            Prices shown in Kenyan shillings (KSh)
          </span>
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingState rows={5} />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title={
                products.length === 0
                  ? "No products yet"
                  : "No matching products"
              }
              hint={
                products.length === 0
                  ? "Add your first product to start building your catalogue."
                  : "Try a different search term or clear your filters."
              }
              action={
                products.length === 0 ? (
                  <Button onClick={openCreateForm}>+ Add product</Button>
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
              columns={productColumns}
              rows={paginatedProducts}
              rowKey={(product) => product.id}
              emptyMessage="No products found."
            />
            <Pagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredProducts.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* PRODUCT MODAL */}
      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId !== null ? "Edit product" : "Add product"}
        description="Maintain accurate product information and pricing."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="min-w-0 space-y-6">
          <ModalError message={error} />
          <Notice message={notice} />

          <FormSection
            title="Basic information"
            description="Identify the product in your catalogue."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FormField label="SKU" required>
                <Input
                  value={form.sku}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sku: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>

              <FormField label="Product name" required>
                <Input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>

              <div className="sm:col-span-2">
                <FormField label="Description">
                  <Input
                    value={form.description}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Optional product details"
                  />
                </FormField>
              </div>
            </div>
          </FormSection>

          <FormSection
            title="Classification"
            description="Organise products for easier searching and reporting."
          >
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RelationshipField
                label="Category"
                value={form.category_id}
                options={categories}
                placeholder="Select a category"
                required
                showCreate={showNewCategory}
                newValue={newCategoryName}
                saving={savingCategory}
                onChange={(value) =>
                  setForm((current) => ({ ...current, category_id: value }))
                }
                onNewValueChange={setNewCategoryName}
                onOpenCreate={() => {
                  setShowNewCategory(true);
                  setShowNewBrand(false);
                  setError("");
                  setNotice("");
                }}
                onCancelCreate={() => {
                  setShowNewCategory(false);
                  setNewCategoryName("");
                }}
                onCreate={() => void createCategory()}
              />

              <RelationshipField
                label="Brand"
                value={form.brand_id}
                options={brands}
                placeholder="No brand selected"
                showCreate={showNewBrand}
                newValue={newBrandName}
                saving={savingBrand}
                onChange={(value) =>
                  setForm((current) => ({ ...current, brand_id: value }))
                }
                onNewValueChange={setNewBrandName}
                onOpenCreate={() => {
                  setShowNewBrand(true);
                  setShowNewCategory(false);
                  setError("");
                  setNotice("");
                }}
                onCancelCreate={() => {
                  setShowNewBrand(false);
                  setNewBrandName("");
                }}
                onCreate={() => void createBrand()}
              />

              <FormField label="Unit of measurement" required>
                <Select
                  value={form.unit}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      unit: event.target.value,
                    }))
                  }
                  options={UNITS}
                  required
                />
              </FormField>
            </div>
          </FormSection>

          <FormSection
            title="Pricing and tax"
            description={
              canViewTotals
                ? "Set the buying cost, selling price and applicable tax rate."
                : "Set the selling price and applicable tax rate."
            }
          >
            <div
              className={`grid grid-cols-1 gap-4 ${
                canViewTotals ? "sm:grid-cols-3" : "sm:grid-cols-2"
              }`}
            >
              {canViewTotals && (
                <FormField label="Cost price (KSh)" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.cost_price}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        cost_price: event.target.value,
                      }))
                    }
                    required
                  />
                </FormField>
              )}

              <FormField label="Selling price (KSh)" required>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.selling_price}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      selling_price: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>

              <FormField label="Tax rate (%)" required>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.tax_rate}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      tax_rate: event.target.value,
                    }))
                  }
                  required
                />
              </FormField>
            </div>
          </FormSection>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  is_active: event.target.checked,
                }))
              }
              className="h-4 w-4 shrink-0 accent-[var(--emerald-600)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--charcoal-800)]">
                Active product
              </span>
              <span className="mt-0.5 block text-xs text-[var(--charcoal-500)]">
                Keep this product available in the active catalogue.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeForm}
              disabled={saving || savingCategory || savingBrand}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={savingCategory || savingBrand}
            >
              {editingId !== null ? "Save changes" : "Create product"}
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
        title="Delete product?"
        description={
          deleteTarget
            ? `Delete "${deleteTarget.name}" (SKU: ${deleteTarget.sku})? This action may not be reversible.`
            : "This action cannot be undone."
        }
        confirmLabel="Delete product"
        cancelLabel="Keep product"
        danger
        loading={deleting}
      />
    </div>
  );
}