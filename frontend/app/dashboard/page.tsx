"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearToken, getToken } from "@/lib/auth";
import {
  Button,
  DataTable,
  EmptyState,
  ErrorState,
  Input,
  LoadingState,
  PageHeader,
  Pagination,
  StatCard,
} from "@/components";
import type { Column } from "@/components";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/Pagination";

type DashboardReport = {
  sales: {
    total_sales: number;
    completed_sales: number;
    draft_sales: number;
    cancelled_sales: number;
    returned_sales: number;
    revenue: string;
    amount_paid: string;
    outstanding_amount: string;
  };
  purchases: {
    total_purchases: number;
    purchase_value: string;
    amount_paid: string;
    outstanding_amount: string;
    received_purchases: number;
    ordered_purchases: number;
  };
  inventory: {
    total_products: number;
    inventory_items: number;
    total_stock_quantity: string;
    low_stock_items: number;
    out_of_stock_items: number;
  };
  expenses: {
    total_expenses: number;
    total_amount: string;
    paid_amount: string;
    pending_expenses: number;
    paid_expenses: number;
  };
  financial: {
    revenue: string;
    sales_collected: string;
    supplier_payments: string;
    operating_expenses_paid: string;
    net_cash_movement: string;
  };
};

type TopProduct = {
  product_id: number;
  product__name: string;
  product__sku: string;
  quantity_sold: string;
  sales_value: string;
};

type DashboardData = {
  report: DashboardReport | null;
  topProducts: TopProduct[];
  customerCount: number;
};

function formatMoney(value: string | number) {
  return `KSh ${Number(value || 0).toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: string | number) {
  return Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  });
}

function getMonthStart() {
  const date = new Date();
  date.setDate(1);

  return date.toISOString().split("T")[0];
}

function getToday() {
  return new Date().toISOString().split("T")[0];
}

export default function DashboardPage() {
  const router = useRouter();

  const [data, setData] = useState<DashboardData>({
    report: null,
    topProducts: [],
    customerCount: 0,
  });

  const [dateFrom, setDateFrom] = useState(getMonthStart());
  const [dateTo, setDateTo] = useState(getToday());
  const [topProductsPage, setTopProductsPage] = useState(1);

  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(
    async (refresh = false) => {
      const token = getToken();

      if (!token) {
        router.replace("/login");
        return;
      }

      if (dateFrom > dateTo) {
        setError("The start date cannot be after the end date.");
        return;
      }

      setError("");

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const params = new URLSearchParams({
          date_from: dateFrom,
          date_to: dateTo,
        });

        const [report, topProducts, customers] = await Promise.all([
          apiFetch<DashboardReport>(
            `/api/reports/dashboard/?${params.toString()}`,
            { token },
          ),

          apiFetch<TopProduct[]>(
            `/api/reports/top-products/?${params.toString()}&limit=${DEFAULT_PAGE_SIZE}`,
            { token },
          ),

          apiFetch<unknown[]>("/api/customers/", { token }),
        ]);

        setData({
          report,
          topProducts,
          customerCount: customers.length,
        });
        setTopProductsPage(1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load dashboard.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateFrom, dateTo, router],
  );

  useEffect(() => {
    const token = getToken();

    if (!token) {
      router.replace("/login");
      return;
    }

    setAuthenticated(true);
    void loadDashboard();
  }, [router, loadDashboard]);

  const totalTopProductPages = Math.max(
    1,
    Math.ceil(data.topProducts.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (topProductsPage > totalTopProductPages) {
      setTopProductsPage(totalTopProductPages);
    }
  }, [topProductsPage, totalTopProductPages]);

  const paginatedTopProducts = useMemo(() => {
    const start = (topProductsPage - 1) * DEFAULT_PAGE_SIZE;
    return data.topProducts.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [data.topProducts, topProductsPage]);

  function handleLogout() {
    clearToken();
    router.replace("/login");
  }

  if (!authenticated) {
    return null;
  }

  const report = data.report;

  const topProductColumns: Column<TopProduct>[] = [
    {
      key: "product__name",
      label: "Product",
      render: (product) => (
        <div className="min-w-0">
          <p className="break-words font-semibold text-[var(--charcoal-900)]">
            {product.product__name}
          </p>
          <p className="mt-0.5 break-all font-mono text-xs text-[var(--charcoal-500)]">
            {product.product__sku || "No SKU"}
          </p>
        </div>
      ),
    },
    {
      key: "quantity_sold",
      label: "Qty",
      align: "right",
      render: (product) => (
        <span className="font-semibold tabular-nums text-[var(--charcoal-900)]">
          {formatNumber(product.quantity_sold)}
        </span>
      ),
    },
    {
      key: "sales_value",
      label: "Value",
      align: "right",
      render: (product) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {formatMoney(product.sales_value)}
        </span>
      ),
    },
  ];

  const netCash = report ? Number(report.financial.net_cash_movement || 0) : 0;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Business dashboard"
        subtitle="A live operational view of your BuildOps business."
        breadcrumb={[{ label: "Dashboard" }]}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full sm:w-40"
              />

              <Input
                label="To"
                type="date"
                value={dateTo}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full sm:w-40"
              />
            </div>

            <div className="flex items-center gap-2">
              <Button
                className="flex-1 sm:flex-initial"
                onClick={() => void loadDashboard(true)}
                loading={refreshing}
                disabled={loading}
              >
                Refresh
              </Button>

              <Button
                className="flex-1 sm:flex-initial"
                variant="outline"
                onClick={handleLogout}
              >
                Logout
              </Button>
            </div>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Dashboard could not be loaded"
          message={error}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard(true)}
            >
              Retry
            </Button>
          }
        />
      )}

      {loading && !report ? (
        <LoadingState rows={6} />
      ) : report ? (
        <div className="min-w-0 space-y-6 sm:space-y-8">
          {/* Primary KPIs */}
          <section className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
            <StatCard
              label="Revenue"
              value={formatMoney(report.financial.revenue)}
              hint="Selected period"
              tone="success"
            />

            <StatCard
              label="Sales collected"
              value={formatMoney(report.financial.sales_collected)}
              hint="Payments received"
              tone="default"
            />

            <StatCard
              label="Net cash movement"
              value={formatMoney(report.financial.net_cash_movement)}
              hint="Collected less payments out"
              tone={netCash < 0 ? "danger" : "success"}
            />

            <StatCard
              label="Outstanding sales"
              value={formatMoney(report.sales.outstanding_amount)}
              hint="Awaiting customer payment"
              tone={
                Number(report.sales.outstanding_amount || 0) > 0
                  ? "warning"
                  : "default"
              }
            />
          </section>

          {/* Operational snapshot */}
          <section className="min-w-0">
            <SectionHeading
              title="Operational snapshot"
              description="Current activity across the core business areas."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <Link href="/dashboard/products" className="block min-w-0">
                <StatCard
                  label="Products"
                  value={formatNumber(report.inventory.total_products)}
                  hint="Active products"
                  tone="default"
                />
              </Link>

              <Link href="/dashboard/customers" className="block min-w-0">
                <StatCard
                  label="Customers"
                  value={formatNumber(data.customerCount)}
                  hint="Customer records"
                  tone="default"
                />
              </Link>

              <Link href="/dashboard/inventory" className="block min-w-0">
                <StatCard
                  label="Low stock"
                  value={formatNumber(report.inventory.low_stock_items)}
                  hint={`${report.inventory.out_of_stock_items} out of stock`}
                  tone={
                    report.inventory.low_stock_items > 0 ||
                    report.inventory.out_of_stock_items > 0
                      ? "warning"
                      : "default"
                  }
                />
              </Link>

              <Link href="/dashboard/sales" className="block min-w-0">
                <StatCard
                  label="Sales"
                  value={formatNumber(report.sales.completed_sales)}
                  hint={`${report.sales.draft_sales} draft`}
                  tone="default"
                />
              </Link>
            </div>
          </section>

          {/* Business position */}
          <section className="min-w-0">
            <SectionHeading
              title="Business position"
              description="Key figures from the selected reporting period."
            />

            <div className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-3">
              <Panel title="Sales">
                <PositionRow
                  label="Revenue"
                  value={formatMoney(report.sales.revenue)}
                />
                <PositionRow
                  label="Collected"
                  value={formatMoney(report.sales.amount_paid)}
                />
                <PositionRow
                  label="Outstanding"
                  value={formatMoney(report.sales.outstanding_amount)}
                />
                <PositionRow
                  label="Completed"
                  value={formatNumber(report.sales.completed_sales)}
                />
              </Panel>

              <Panel title="Purchases">
                <PositionRow
                  label="Purchase value"
                  value={formatMoney(report.purchases.purchase_value)}
                />
                <PositionRow
                  label="Paid"
                  value={formatMoney(report.purchases.amount_paid)}
                />
                <PositionRow
                  label="Outstanding"
                  value={formatMoney(report.purchases.outstanding_amount)}
                />
                <PositionRow
                  label="Received"
                  value={formatNumber(report.purchases.received_purchases)}
                />
              </Panel>

              <Panel title="Expenses">
                <PositionRow
                  label="Total expenses"
                  value={formatMoney(report.expenses.total_amount)}
                />
                <PositionRow
                  label="Paid"
                  value={formatMoney(report.expenses.paid_amount)}
                />
                <PositionRow
                  label="Pending"
                  value={formatNumber(report.expenses.pending_expenses)}
                />
                <PositionRow
                  label="Total records"
                  value={formatNumber(report.expenses.total_expenses)}
                />
              </Panel>
            </div>
          </section>

          {/* Inventory position */}
          <section className="min-w-0">
            <SectionHeading
              title="Inventory position"
              description="Current stock status across active inventory."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-3">
              <StatCard
                label="Stock quantity"
                value={formatNumber(report.inventory.total_stock_quantity)}
                hint={`${formatNumber(report.inventory.inventory_items)} inventory items`}
                tone="default"
              />

              <StatCard
                label="Low stock items"
                value={formatNumber(report.inventory.low_stock_items)}
                hint="At or below reorder level"
                tone={report.inventory.low_stock_items > 0 ? "warning" : "default"}
              />

              <StatCard
                label="Out of stock"
                value={formatNumber(report.inventory.out_of_stock_items)}
                hint="Needs restocking"
                tone={
                  report.inventory.out_of_stock_items > 0 ? "danger" : "default"
                }
              />
            </div>
          </section>

          {/* Top products + quick actions */}
          <section className="grid min-w-0 grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-[1.5fr_1fr]">
            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
              <div className="flex flex-col gap-2 border-b border-[var(--border-soft)] p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold text-[var(--charcoal-900)]">
                    Top products
                  </h2>
                  <p className="mt-1 text-sm text-[var(--charcoal-500)]">
                    Highest quantities sold in the selected period.
                  </p>
                </div>

                <Link
                  href="/dashboard/reports"
                  className="shrink-0 text-sm font-medium text-[var(--emerald-700)] hover:underline"
                >
                  Full reports →
                </Link>
              </div>

              {data.topProducts.length === 0 ? (
                <div className="p-6 sm:p-8">
                  <EmptyState
                    title="No product sales"
                    hint="No product sales found for this period."
                  />
                </div>
              ) : (
                <>
                  <DataTable
                    columns={topProductColumns}
                    rows={paginatedTopProducts}
                    rowKey={(product) => product.product_id}
                    emptyMessage="No product sales found."
                  />
                  <Pagination
                    page={topProductsPage}
                    pageSize={DEFAULT_PAGE_SIZE}
                    totalItems={data.topProducts.length}
                    onPageChange={setTopProductsPage}
                  />
                </>
              )}
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
              <div className="border-b border-[var(--border-soft)] p-4">
                <h2 className="font-semibold text-[var(--charcoal-900)]">
                  Quick actions
                </h2>
                <p className="mt-1 text-sm text-[var(--charcoal-500)]">
                  Move directly into common workflows.
                </p>
              </div>

              <div className="grid gap-2 p-4">
                <QuickAction href="/dashboard/sales" label="Manage sales" />
                <QuickAction
                  href="/dashboard/purchases"
                  label="Manage purchases"
                />
                <QuickAction
                  href="/dashboard/inventory"
                  label="Check inventory"
                />
                <QuickAction
                  href="/dashboard/customers"
                  label="Manage customers"
                />
                <QuickAction
                  href="/dashboard/expenses"
                  label="Review expenses"
                />

                <QuickAction href="/dashboard/expenses" label="Receipts" />

                <QuickAction
                  href="/dashboard/ai"
                  label="Ask BuildOps AI"
                  emphasis
                />
              </div>
            </div>
          </section>

          {/* Cash movement */}
          <section className="min-w-0">
            <SectionHeading
              title="Cash movement"
              description="Management-level cash movement for the selected period."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:gap-4 md:grid-cols-3">
              <StatCard
                label="Sales collected"
                value={formatMoney(report.financial.sales_collected)}
                hint="Money in"
                tone="success"
              />

              <StatCard
                label="Supplier payments"
                value={formatMoney(report.financial.supplier_payments)}
                hint="Money out"
                tone="default"
              />

              <StatCard
                label="Operating expenses"
                value={formatMoney(report.financial.operating_expenses_paid)}
                hint="Money out"
                tone="default"
              />
            </div>
          </section>
        </div>
      ) : (
        !error && (
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            <EmptyState
              title="No dashboard data available"
              hint="Adjust the date range and refresh to try again."
            />
          </div>
        )
      )}
    </div>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-3 sm:mb-4">
      <h2 className="font-semibold text-[var(--charcoal-900)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--charcoal-500)]">{description}</p>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
      <div className="border-b border-[var(--border-soft)] p-4">
        <h3 className="font-semibold text-[var(--charcoal-900)]">{title}</h3>
      </div>

      <div className="px-4">{children}</div>
    </div>
  );
}

function PositionRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-b border-[var(--border-soft)] py-3 last:border-0">
      <span className="break-words text-sm text-[var(--charcoal-500)]">
        {label}
      </span>
      <span className="whitespace-nowrap text-sm font-semibold tabular-nums text-[var(--charcoal-900)]">
        {value}
      </span>
    </div>
  );
}

function QuickAction({
  href,
  label,
  emphasis = false,
}: {
  href: string;
  label: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      href={href}
      className={
        emphasis
          ? "flex min-h-10 items-center justify-between rounded-xl bg-[#15803d] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#166534]"
          : "flex min-h-10 items-center justify-between rounded-xl border border-[#d9e3db] bg-white px-4 py-2 text-sm font-semibold text-[#25332a] transition hover:border-[#b9c7bc] hover:bg-[#f8faf8]"
      }
    >
      <span className="break-words">{label}</span>
      <span aria-hidden className="shrink-0">
        →
      </span>
    </Link>
  );
}