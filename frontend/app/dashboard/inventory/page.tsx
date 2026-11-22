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

type Product = {
  id: number;
  sku: string;
  name: string;
};

type InventoryItem = {
  id: number;
  organization_id: number;
  product: number;
  quantity: string;
  reorder_level: string;
  reorder_quantity: string;
  location: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type StockMovement = {
  id: number;
  organization_id: number;
  inventory_item: number;
  purchase_id: number | null;
  sale_id: number | null;
  movement_type: string;
  quantity: string;
  reference: string | null;
  notes: string | null;
  created_by_id: number | null;
  created_at: string;
};

type InventoryForm = {
  product_id: string;
  quantity: string;
  reorder_level: string;
  reorder_quantity: string;
  location: string;
  is_active: boolean;
};

type MovementForm = {
  inventory_item_id: string;
  movement_type: string;
  quantity: string;
  reference: string;
  notes: string;
};

const emptyInventoryForm: InventoryForm = {
  product_id: "",
  quantity: "0",
  reorder_level: "5",
  reorder_quantity: "10",
  location: "Main Store",
  is_active: true,
};

const emptyMovementForm: MovementForm = {
  inventory_item_id: "",
  movement_type: "adjustment",
  quantity: "",
  reference: "",
  notes: "",
};

const fieldClass =
  "mt-1.5 min-h-11 w-full min-w-0 rounded-lg border border-[var(--border)] bg-white px-3 py-2.5 text-base text-[var(--charcoal-900)] outline-none transition placeholder:text-[#9aa69e] focus:border-[var(--emerald-500)] focus:ring-2 focus:ring-[var(--emerald-500)]/15 sm:min-h-0 sm:text-sm";

const labelClass =
  "mb-1.5 block text-xs font-bold text-[var(--charcoal-700)]";

const movementOptions = [
  { value: "adjustment", label: "Adjustment" },
  { value: "damage", label: "Damage / Loss" },
  { value: "opening", label: "Opening Stock" },
  { value: "return_in", label: "Customer Return" },
  { value: "return_out", label: "Supplier Return" },
  { value: "transfer_in", label: "Transfer In" },
  { value: "transfer_out", label: "Transfer Out" },
];

const statusOptions = [
  { value: "all", label: "All inventory" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "low", label: "Low stock" },
];

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function formatMovementType(value: string) {
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

export default function InventoryPage() {
  const token = getToken();

  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);

  const [inventoryForm, setInventoryForm] =
    useState<InventoryForm>(emptyInventoryForm);
  const [movementForm, setMovementForm] =
    useState<MovementForm>(emptyMovementForm);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteTarget, setDeleteTarget] =
    useState<InventoryItem | null>(null);

  const [showInventoryForm, setShowInventoryForm] = useState(false);
  const [showMovementForm, setShowMovementForm] = useState(false);
  const [showMovements, setShowMovements] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingMovement, setSavingMovement] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const productMap = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );

  const getProduct = useCallback(
    (productId: number) => productMap.get(productId),
    [productMap],
  );

  const isLowStock = useCallback(
    (item: InventoryItem) =>
      Number(item.quantity) <= Number(item.reorder_level),
    [],
  );

  const loadData = useCallback(async () => {
    if (!token) {
      setError("You are not authenticated.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [inventoryData, productsData, movementsData] =
        await Promise.all([
          apiFetch<InventoryItem[]>("/api/inventory/", { token }),
          apiFetch<Product[]>("/api/products/", { token }),
          apiFetch<StockMovement[]>("/api/stock-movements/", { token }),
        ]);

      setInventory(inventoryData);
      setProducts(productsData);
      setMovements(movementsData);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load inventory data.",
      );
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredInventory = useMemo(() => {
    const searchText = search.toLowerCase().trim();

    return inventory.filter((item) => {
      const product = getProduct(item.product);

      const matchesSearch =
        !searchText ||
        product?.name.toLowerCase().includes(searchText) ||
        product?.sku.toLowerCase().includes(searchText) ||
        item.location.toLowerCase().includes(searchText);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active) ||
        (statusFilter === "low" && isLowStock(item));

      return Boolean(matchesSearch && matchesStatus);
    });
  }, [inventory, search, statusFilter, getProduct, isLowStock]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.max(
    1,
    Math.ceil(filteredInventory.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const paginatedInventory = useMemo(() => {
    const start = (page - 1) * DEFAULT_PAGE_SIZE;
    return filteredInventory.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [filteredInventory, page]);

  const sortedMovements = useMemo(
    () =>
      [...movements].sort(
        (a, b) =>
          new Date(b.created_at).getTime() -
          new Date(a.created_at).getTime(),
      ),
    [movements],
  );

  const lowStockCount = inventory.filter(isLowStock).length;

  const totalUnits = inventory.reduce(
    (total, item) => total + Number(item.quantity),
    0,
  );

  function clearFilters() {
    setSearch("");
    setStatusFilter("all");
    setPage(1);
  }

  function openCreateForm() {
    setEditingId(null);
    setInventoryForm({ ...emptyInventoryForm });
    setShowInventoryForm(true);
    setError("");
  }

  function openEditForm(item: InventoryItem) {
    setEditingId(item.id);
    setInventoryForm({
      product_id: String(item.product),
      quantity: item.quantity,
      reorder_level: item.reorder_level,
      reorder_quantity: item.reorder_quantity,
      location: item.location,
      is_active: item.is_active,
    });
    setShowInventoryForm(true);
    setError("");
  }

  function closeInventoryForm() {
    if (saving) return;
    setShowInventoryForm(false);
    setEditingId(null);
    setInventoryForm({ ...emptyInventoryForm });
  }

  function openMovementForm(item?: InventoryItem) {
    setMovementForm({
      ...emptyMovementForm,
      inventory_item_id: item ? String(item.id) : "",
    });
    setShowMovementForm(true);
    setError("");
  }

  function closeMovementForm() {
    if (savingMovement) return;
    setShowMovementForm(false);
    setMovementForm({ ...emptyMovementForm });
  }

  async function handleInventorySubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload = {
        product: Number(inventoryForm.product_id),
        quantity: inventoryForm.quantity,
        reorder_level: inventoryForm.reorder_level,
        reorder_quantity: inventoryForm.reorder_quantity,
        location: inventoryForm.location,
        is_active: inventoryForm.is_active,
      };

      if (editingId !== null) {
        await apiFetch<InventoryItem>(`/api/inventory/${editingId}/`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch<InventoryItem>("/api/inventory/", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      }

      setShowInventoryForm(false);
      setEditingId(null);
      setInventoryForm({ ...emptyInventoryForm });
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save inventory item.",
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

      await apiFetch(`/api/inventory/${deleteTarget.id}/`, {
        method: "DELETE",
        token,
      });

      setDeleteTarget(null);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to delete inventory item.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function handleMovementSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!token) {
      setError("You are not authenticated.");
      return;
    }

    try {
      setSavingMovement(true);
      setError("");

      const payload = {
        inventory_item: Number(movementForm.inventory_item_id),
        movement_type: movementForm.movement_type,
        quantity: movementForm.quantity,
        reference: movementForm.reference || "",
        notes: movementForm.notes || "",
      };

      await apiFetch<StockMovement>("/api/stock-movements/", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });

      setShowMovementForm(false);
      setMovementForm({ ...emptyMovementForm });
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to record stock movement.",
      );
    } finally {
      setSavingMovement(false);
    }
  }

  const inventoryColumns: Column<InventoryItem>[] = [
    {
      key: "product",
      label: "Product",
      render: (item) => {
        const product = getProduct(item.product);

        return (
          <div className="min-w-0">
            <p className="break-words font-semibold text-[var(--charcoal-900)]">
              {product?.name || `Product #${item.product}`}
            </p>
            {product?.sku && (
              <p className="mt-0.5 font-mono text-xs text-[var(--charcoal-500)]">
                {product.sku}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "location",
      label: "Location",
      hideBelow: "md",
      render: (item) => (
        <span className="break-words text-[var(--charcoal-700)]">
          {item.location || "—"}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      render: (item) => (
        <span
          className={
            item.is_active && isLowStock(item)
              ? "whitespace-nowrap font-semibold tabular-nums text-amber-700"
              : "whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]"
          }
        >
          {Number(item.quantity).toLocaleString()}
        </span>
      ),
    },
    {
      key: "reorder_level",
      label: "Reorder level",
      hideBelow: "lg",
      render: (item) => (
        <span className="whitespace-nowrap tabular-nums">
          {item.reorder_level}
        </span>
      ),
    },
    {
      key: "reorder_quantity",
      label: "Reorder quantity",
      hideBelow: "lg",
      render: (item) => (
        <span className="whitespace-nowrap tabular-nums">
          {item.reorder_quantity}
        </span>
      ),
    },
    {
      key: "is_active",
      label: "Status",
      hideBelow: "sm",
      render: (item) => {
        if (!item.is_active) {
          return <StatusBadge status="inactive" />;
        }

        return isLowStock(item) ? (
          <StatusBadge status="low_stock" />
        ) : (
          <StatusBadge status="active" />
        );
      },
    },
    {
      key: "id",
      label: "Actions",
      render: (item) => (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => openMovementForm(item)}
          >
            Movement
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => openEditForm(item)}
          >
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDeleteTarget(item)}
          >
            <span className="text-red-700">Delete</span>
          </Button>
        </div>
      ),
    },
  ];

  const movementColumns: Column<StockMovement>[] = [
    {
      key: "created_at",
      label: "Date",
      render: (movement) => (
        <span className="whitespace-nowrap text-xs text-[var(--charcoal-600)]">
          {formatDate(movement.created_at)}
        </span>
      ),
    },
    {
      key: "inventory_item",
      label: "Product",
      render: (movement) => {
        const item = inventory.find(
          (entry) => entry.id === movement.inventory_item,
        );
        const product = item ? getProduct(item.product) : undefined;

        return (
          <div className="min-w-0">
            <p className="break-words font-medium text-[var(--charcoal-900)]">
              {product?.name || `Inventory #${movement.inventory_item}`}
            </p>
            {item && (
              <p className="mt-0.5 break-words text-xs text-[var(--charcoal-500)]">
                {item.location}
              </p>
            )}
          </div>
        );
      },
    },
    {
      key: "movement_type",
      label: "Movement type",
      hideBelow: "sm",
      render: (movement) => (
        <span className="whitespace-nowrap capitalize text-[var(--charcoal-700)]">
          {formatMovementType(movement.movement_type)}
        </span>
      ),
    },
    {
      key: "quantity",
      label: "Quantity",
      render: (movement) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {movement.quantity}
        </span>
      ),
    },
    {
      key: "reference",
      label: "Reference",
      hideBelow: "md",
      render: (movement) => movement.reference || "—",
    },
    {
      key: "notes",
      label: "Notes",
      hideBelow: "lg",
      render: (movement) => (
        <span className="block max-w-56 truncate text-[var(--charcoal-600)]">
          {movement.notes || "—"}
        </span>
      ),
    },
  ];

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Inventory"
        subtitle="Monitor stock levels, reorder points and stock movements."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Inventory" },
        ]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => openMovementForm()}
            >
              + Stock movement
            </Button>
            <Button onClick={openCreateForm}>
              + Add inventory
            </Button>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Inventory operation failed"
          message={error}
          action={
            <Button variant="outline" size="sm" onClick={() => void loadData()}>
              Retry loading
            </Button>
          }
        />
      )}

      <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
        <StatCard
          label="Inventory records"
          value={inventory.length.toLocaleString()}
          hint="Tracked inventory items"
          tone="default"
        />
        <StatCard
          label="Total units"
          value={totalUnits.toLocaleString()}
          hint="Combined recorded quantity"
          tone="default"
        />
        <StatCard
          label="Low stock"
          value={lowStockCount.toLocaleString()}
          hint="Items at or below reorder level"
          tone={lowStockCount > 0 ? "warning" : "default"}
        />
      </div>

      <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-3 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Stock records
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Search products and monitor stock availability.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={showMovements ? "primary" : "outline"}
              size="sm"
              onClick={() => setShowMovements((visible) => !visible)}
            >
              {showMovements ? "Hide movements" : "Movement history"}
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

        <div className="grid min-w-0 grid-cols-1 gap-3 border-b border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 md:grid-cols-[minmax(220px,1fr)_190px_auto]">
          <SearchBar
            value={search}
            onChange={setSearch}
            onClear={() => setSearch("")}
            placeholder="Search product, SKU or location..."
          />

          <Select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            options={statusOptions}
            aria-label="Filter inventory status"
          />

          <Button variant="outline" onClick={clearFilters}>
            Clear filters
          </Button>
        </div>

        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm text-[var(--charcoal-500)]">
            Showing{" "}
            <span className="font-semibold text-[var(--charcoal-800)]">
              {filteredInventory.length}
            </span>{" "}
            of {inventory.length} records
          </p>
          {statusFilter === "low" && (
            <span className="text-xs font-medium text-amber-700">
              Reorder attention
            </span>
          )}
        </div>

        {loading ? (
          <div className="p-4">
            <LoadingState rows={5} />
          </div>
        ) : filteredInventory.length === 0 ? (
          <div className="p-6 sm:p-8">
            <EmptyState
              title={
                inventory.length === 0
                  ? "No inventory records yet"
                  : "No matching inventory"
              }
              hint={
                inventory.length === 0
                  ? "Add an inventory record to start tracking stock."
                  : "Try a different search term or clear your filters."
              }
              action={
                inventory.length === 0 ? (
                  <Button onClick={openCreateForm}>
                    + Add inventory
                  </Button>
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
              columns={inventoryColumns}
              rows={paginatedInventory}
              rowKey={(item) => item.id}
              emptyMessage="No inventory records found."
            />
            <Pagination
              page={page}
              pageSize={DEFAULT_PAGE_SIZE}
              totalItems={filteredInventory.length}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {showMovements && (
        <section className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
          <div className="border-b border-[var(--border-soft)] p-4">
            <h2 className="font-semibold text-[var(--charcoal-900)]">
              Stock movement history
            </h2>
            <p className="mt-1 text-sm text-[var(--charcoal-500)]">
              Review recorded adjustments and other stock movements.
            </p>
          </div>

          {movements.length === 0 ? (
            <div className="p-6 sm:p-8">
              <EmptyState
                title="No stock movements"
                hint="Recorded stock movements will appear here."
                action={
                  <Button onClick={() => openMovementForm()}>
                    Record movement
                  </Button>
                }
              />
            </div>
          ) : (
            <DataTable
              columns={movementColumns}
              rows={sortedMovements}
              rowKey={(movement) => movement.id}
              emptyMessage="No stock movements found."
            />
          )}
        </section>
      )}

      <Modal
        open={showInventoryForm}
        onClose={closeInventoryForm}
        title={editingId !== null ? "Edit inventory" : "Add inventory"}
        description="Configure the product, stock quantity and reorder settings."
        size="lg"
      >
        <form onSubmit={handleInventorySubmit} className="min-w-0 space-y-5">
          <FormField label="Product" required>
            <select
              value={inventoryForm.product_id}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  product_id: event.target.value,
                }))
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
            {products.length === 0 && (
              <p className="mt-1.5 text-xs text-amber-700">
                No products are available. Create a product first.
              </p>
            )}
          </FormField>

          <FormField label="Location" required>
            <Input
              value={inventoryForm.location}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  location: event.target.value,
                }))
              }
              required
              placeholder="e.g. Main Store"
            />
          </FormField>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label="Quantity" required>
              <Input
                type="number"
                value={inventoryForm.quantity}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Reorder level" required>
              <Input
                type="number"
                value={inventoryForm.reorder_level}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    reorder_level: event.target.value,
                  }))
                }
                required
              />
            </FormField>

            <FormField label="Reorder quantity" required>
              <Input
                type="number"
                value={inventoryForm.reorder_quantity}
                onChange={(event) =>
                  setInventoryForm((current) => ({
                    ...current,
                    reorder_quantity: event.target.value,
                  }))
                }
                required
              />
            </FormField>
          </div>

          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
            <input
              type="checkbox"
              checked={inventoryForm.is_active}
              onChange={(event) =>
                setInventoryForm((current) => ({
                  ...current,
                  is_active: event.target.checked,
                }))
              }
              className="h-4 w-4 shrink-0 accent-[var(--emerald-600)]"
            />
            <span className="min-w-0">
              <span className="block text-sm font-medium text-[var(--charcoal-800)]">
                Active inventory record
              </span>
              <span className="mt-0.5 block text-xs text-[var(--charcoal-500)]">
                Keep this record active for inventory monitoring.
              </span>
            </span>
          </label>

          <div className="flex flex-wrap justify-end gap-2 border-t border-[var(--border-soft)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={closeInventoryForm}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={saving}
              disabled={!products.length}
            >
              {editingId !== null ? "Save changes" : "Create inventory"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showMovementForm}
        onClose={closeMovementForm}
        title="Record stock movement"
        description="Record an adjustment or movement against an inventory item."
        size="lg"
      >
        <form onSubmit={handleMovementSubmit} className="min-w-0 space-y-5">
          <FormField label="Inventory item" required>
            <select
              value={movementForm.inventory_item_id}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  inventory_item_id: event.target.value,
                }))
              }
              required
              className={fieldClass}
            >
              <option value="">Select inventory item</option>
              {inventory.map((item) => {
                const product = getProduct(item.product);

                return (
                  <option key={item.id} value={item.id}>
                    {product?.name || `Product #${item.product}`} —{" "}
                    {item.location} — Qty {item.quantity}
                  </option>
                );
              })}
            </select>
          </FormField>

          <FormField label="Movement type" required>
            <Select
              value={movementForm.movement_type}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  movement_type: event.target.value,
                }))
              }
              options={movementOptions}
              required
            />
          </FormField>

          <FormField label="Quantity" required>
            <Input
              type="number"
              value={movementForm.quantity}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  quantity: event.target.value,
                }))
              }
              required
            />
          </FormField>

          <FormField label="Reference">
            <Input
              value={movementForm.reference}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  reference: event.target.value,
                }))
              }
              placeholder="Optional reference"
            />
          </FormField>

          <FormField label="Notes">
            <textarea
              value={movementForm.notes}
              onChange={(event) =>
                setMovementForm((current) => ({
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
              onClick={closeMovementForm}
              disabled={savingMovement}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={savingMovement}
              disabled={!inventory.length}
            >
              Record movement
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => {
          if (!deleting) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDelete()}
        title="Delete inventory record?"
        description={
          deleteTarget
            ? `Delete the inventory record for "${
                getProduct(deleteTarget.product)?.name ||
                `Product #${deleteTarget.product}`
              }" at ${deleteTarget.location || "this location"}?`
            : "This action cannot be undone."
        }
        confirmLabel="Delete inventory"
        cancelLabel="Keep record"
        danger
        loading={deleting}
      />
    </div>
  );
}