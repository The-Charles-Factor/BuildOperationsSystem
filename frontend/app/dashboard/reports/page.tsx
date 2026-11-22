"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import { getToken } from "@/lib/auth";
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
    draft_purchases: number;
    ordered_purchases: number;
    partially_received: number;
    received_purchases: number;
    cancelled_purchases: number;
    purchase_value: string;
    amount_paid: string;
    outstanding_amount: string;
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
    pending_expenses: number;
    approved_expenses: number;
    paid_expenses: number;
    cancelled_expenses: number;
    total_amount: string;
    paid_amount: string;
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

type ExpenseCategory = {
  category_id: number;
  category__name: string;
  total_amount: string;
  expense_count: number;
};

type ReportsData = {
  dashboard: DashboardReport | null;
  topProducts: TopProduct[];
  expenseCategories: ExpenseCategory[];
};

function formatMoney(value: string | number) {
  const amount = Number(value || 0);

  return `KSh ${amount.toLocaleString("en-KE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatNumber(value: string | number) {
  return Number(value || 0).toLocaleString("en-KE", {
    maximumFractionDigits: 2,
  });
}

function localDateString(date: Date) {
  const localDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );

  return localDate.toISOString().split("T")[0];
}

function today() {
  return localDateString(new Date());
}

function firstDayOfMonth() {
  const date = new Date();
  date.setDate(1);
  return localDateString(date);
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportsData>({
    dashboard: null,
    topProducts: [],
    expenseCategories: [],
  });

  const [dateFrom, setDateFrom] = useState(firstDayOfMonth());
  const [dateTo, setDateTo] = useState(today());
  const [productsPage, setProductsPage] = useState(1);
  const [categoriesPage, setCategoriesPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(
    async (isRefresh = false) => {
      const token = getToken();

      if (!token) {
        setError("You are not authenticated.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (dateFrom && dateTo && dateFrom > dateTo) {
        setError("The start date cannot be after the end date.");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const params = new URLSearchParams();

        if (dateFrom) params.set("date_from", dateFrom);
        if (dateTo) params.set("date_to", dateTo);

        const query = params.toString();
        const suffix = query ? `?${query}` : "";

        const [dashboard, topProducts, expenseCategories] = await Promise.all([
          apiFetch<DashboardReport>(`/api/reports/dashboard/${suffix}`, {
            token,
          }),
          apiFetch<TopProduct[]>(
            `/api/reports/top-products/${suffix}${suffix ? "&" : "?"}limit=10`,
            { token },
          ),
          apiFetch<ExpenseCategory[]>(
            `/api/reports/expenses-by-category/${suffix}`,
            { token },
          ),
        ]);

        setData({
          dashboard,
          topProducts,
          expenseCategories,
        });
        setProductsPage(1);
        setCategoriesPage(1);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load reports.",
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [dateFrom, dateTo],
  );

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const totalProductPages = Math.max(
    1,
    Math.ceil(data.topProducts.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (productsPage > totalProductPages) setProductsPage(totalProductPages);
  }, [productsPage, totalProductPages]);

  const paginatedTopProducts = useMemo(() => {
    const start = (productsPage - 1) * DEFAULT_PAGE_SIZE;
    return data.topProducts.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [data.topProducts, productsPage]);

  const totalCategoryPages = Math.max(
    1,
    Math.ceil(data.expenseCategories.length / DEFAULT_PAGE_SIZE),
  );

  useEffect(() => {
    if (categoriesPage > totalCategoryPages) {
      setCategoriesPage(totalCategoryPages);
    }
  }, [categoriesPage, totalCategoryPages]);

  const paginatedExpenseCategories = useMemo(() => {
    const start = (categoriesPage - 1) * DEFAULT_PAGE_SIZE;
    return data.expenseCategories.slice(start, start + DEFAULT_PAGE_SIZE);
  }, [data.expenseCategories, categoriesPage]);

  const report = data.dashboard;

  const topProductColumns: Column<TopProduct>[] = [
    {
      key: "product__name",
      label: "Product",
      render: (product, index) => {
        const rank = (productsPage - 1) * DEFAULT_PAGE_SIZE + index + 1;

        return (
          <div className="flex min-w-0 items-start gap-2.5 sm:gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--emerald-50)] text-xs font-semibold tabular-nums text-[var(--emerald-700)]">
              {rank}
            </span>
            <div className="min-w-0">
              <p className="break-words font-semibold text-[var(--charcoal-900)]">
                {product.product__name}
              </p>
              <p className="mt-0.5 break-all font-mono text-xs text-[var(--charcoal-500)]">
                {product.product__sku || "No SKU"}
              </p>
            </div>
          </div>
        );
      },
    },
    {
      key: "quantity_sold",
      label: "Quantity",
      align: "right",
      render: (product) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {formatNumber(product.quantity_sold)}
        </span>
      ),
    },
    {
      key: "sales_value",
      label: "Sales value",
      align: "right",
      render: (product) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {formatMoney(product.sales_value)}
        </span>
      ),
    },
  ];

  const expenseCategoryColumns: Column<ExpenseCategory>[] = [
    {
      key: "category__name",
      label: "Category",
      render: (category) => (
        <span className="break-words font-semibold text-[var(--charcoal-900)]">
          {category.category__name}
        </span>
      ),
    },
    {
      key: "expense_count",
      label: "Expenses",
      align: "right",
      render: (category) => (
        <span className="tabular-nums">
          {formatNumber(category.expense_count)}
        </span>
      ),
    },
    {
      key: "total_amount",
      label: "Amount",
      align: "right",
      render: (category) => (
        <span className="whitespace-nowrap font-semibold tabular-nums text-[var(--charcoal-900)]">
          {formatMoney(category.total_amount)}
        </span>
      ),
    },
  ];

  const netCash = report ? Number(report.financial.net_cash_movement || 0) : 0;

  return (
    <div className="min-w-0 space-y-5 sm:space-y-6">
      <PageHeader
        title="Reports"
        subtitle="Understand your sales, purchases, inventory, expenses and cash movement from one place."
        breadcrumb={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Reports" },
        ]}
        action={
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-end">
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
              <Input
                label="From"
                type="date"
                value={dateFrom}
                max={dateTo || undefined}
                onChange={(event) => setDateFrom(event.target.value)}
                className="w-full sm:w-40"
              />

              <Input
                label="To"
                type="date"
                value={dateTo}
                min={dateFrom || undefined}
                onChange={(event) => setDateTo(event.target.value)}
                className="w-full sm:w-40"
              />
            </div>

            <Button
              onClick={() => void loadReports(true)}
              loading={refreshing}
              disabled={loading}
              className="w-full sm:w-auto"
            >
              Refresh reports
            </Button>
          </div>
        }
      />

      {error && (
        <ErrorState
          title="Reports could not be loaded"
          message={error}
          action={
            !loading ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadReports(true)}
              >
                Try again
              </Button>
            ) : undefined
          }
        />
      )}

      {loading && !report ? (
        <LoadingState rows={6} />
      ) : report ? (
        <div className="min-w-0 space-y-6 sm:space-y-8">
          {/* Financial overview */}
          <section className="min-w-0">
            <SectionHeading
              title="Financial overview"
              description="Cash and transaction movement for the selected period."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
              <StatCard
                label="Revenue"
                value={formatMoney(report.financial.revenue)}
                hint="Selected period"
                tone="success"
              />
              <StatCard
                label="Sales collected"
                value={formatMoney(report.financial.sales_collected)}
                hint="Money in"
                tone="default"
              />
              <StatCard
                label="Supplier payments"
                value={formatMoney(report.financial.supplier_payments)}
                hint="Money out"
                tone="default"
              />
              <StatCard
                label="Operating expenses paid"
                value={formatMoney(report.financial.operating_expenses_paid)}
                hint="Money out"
                tone="default"
              />
              <StatCard
                label="Net cash movement"
                value={formatMoney(report.financial.net_cash_movement)}
                hint="Collected less payments out"
                tone={netCash < 0 ? "danger" : "success"}
              />
            </div>
          </section>

          {/* Sales */}
          <section className="min-w-0">
            <SectionHeading
              title="Sales"
              description="Sales activity, completion, returns and collections."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <StatCard
                label="Total sales"
                value={formatNumber(report.sales.total_sales)}
                hint="All sales in period"
                tone="default"
              />
              <StatCard
                label="Completed sales"
                value={formatNumber(report.sales.completed_sales)}
                hint="Finalised sales"
                tone="default"
              />
              <StatCard
                label="Outstanding amount"
                value={formatMoney(report.sales.outstanding_amount)}
                hint="Awaiting customer payment"
                tone={
                  Number(report.sales.outstanding_amount || 0) > 0
                    ? "warning"
                    : "default"
                }
              />
              <StatCard
                label="Returned sales"
                value={formatNumber(report.sales.returned_sales)}
                hint="Fully returned"
                tone="default"
              />
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Draft sales" value={report.sales.draft_sales} />
              <MiniStat label="Cancelled" value={report.sales.cancelled_sales} />
              <MiniStat label="Revenue" value={formatMoney(report.sales.revenue)} />
              <MiniStat
                label="Collected"
                value={formatMoney(report.sales.amount_paid)}
              />
            </div>
          </section>

          {/* Purchases */}
          <section className="min-w-0">
            <SectionHeading
              title="Purchases"
              description="Supplier purchasing, goods received and payment obligations."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <StatCard
                label="Total purchases"
                value={formatNumber(report.purchases.total_purchases)}
                hint="All purchases in period"
                tone="default"
              />
              <StatCard
                label="Purchase value"
                value={formatMoney(report.purchases.purchase_value)}
                hint="Ordered from suppliers"
                tone="default"
              />
              <StatCard
                label="Paid"
                value={formatMoney(report.purchases.amount_paid)}
                hint="Paid to suppliers"
                tone="default"
              />
              <StatCard
                label="Outstanding"
                value={formatMoney(report.purchases.outstanding_amount)}
                hint="Owed to suppliers"
                tone={
                  Number(report.purchases.outstanding_amount || 0) > 0
                    ? "warning"
                    : "default"
                }
              />
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              <MiniStat label="Draft" value={report.purchases.draft_purchases} />
              <MiniStat
                label="Ordered"
                value={report.purchases.ordered_purchases}
              />
              <MiniStat
                label="Partially received"
                value={report.purchases.partially_received}
              />
              <MiniStat
                label="Received"
                value={report.purchases.received_purchases}
              />
              <MiniStat
                label="Cancelled"
                value={report.purchases.cancelled_purchases}
              />
            </div>
          </section>

          {/* Inventory */}
          <section className="min-w-0">
            <SectionHeading
              title="Inventory"
              description="Current stock position. These metrics are not filtered by date."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-5">
              <StatCard
                label="Active products"
                value={formatNumber(report.inventory.total_products)}
                hint="In the catalogue"
                tone="default"
              />
              <StatCard
                label="Inventory items"
                value={formatNumber(report.inventory.inventory_items)}
                hint="Tracked stock records"
                tone="default"
              />
              <StatCard
                label="Stock quantity"
                value={formatNumber(report.inventory.total_stock_quantity)}
                hint="Combined units"
                tone="default"
              />
              <StatCard
                label="Low stock"
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

          {/* Expenses */}
          <section className="min-w-0">
            <SectionHeading
              title="Expenses"
              description="Operating expense activity for the selected period."
            />

            <div className="grid min-w-0 grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 xl:grid-cols-4">
              <StatCard
                label="Total expenses"
                value={formatNumber(report.expenses.total_expenses)}
                hint="Expense records"
                tone="default"
              />
              <StatCard
                label="Total amount"
                value={formatMoney(report.expenses.total_amount)}
                hint="All statuses"
                tone="default"
              />
              <StatCard
                label="Paid amount"
                value={formatMoney(report.expenses.paid_amount)}
                hint="Completed payments"
                tone="default"
              />
              <StatCard
                label="Pending expenses"
                value={formatNumber(report.expenses.pending_expenses)}
                hint="Awaiting approval"
                tone={
                  report.expenses.pending_expenses > 0 ? "warning" : "default"
                }
              />
            </div>

            <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="Approved" value={report.expenses.approved_expenses} />
              <MiniStat label="Paid" value={report.expenses.paid_expenses} />
              <MiniStat
                label="Cancelled"
                value={report.expenses.cancelled_expenses}
              />
              <MiniStat
                label="Paid amount"
                value={formatMoney(report.expenses.paid_amount)}
              />
            </div>
          </section>

          {/* Detailed analysis */}
          <section className="min-w-0">
            <SectionHeading
              title="Detailed analysis"
              description="Identify best-selling products and see how expenses are distributed."
            />

            <div className="grid min-w-0 grid-cols-1 gap-5 sm:gap-6 xl:grid-cols-2">
              <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
                <div className="border-b border-[var(--border-soft)] p-4">
                  <h3 className="font-semibold text-[var(--charcoal-900)]">
                    Top products
                  </h3>
                  <p className="mt-1 text-sm text-[var(--charcoal-500)]">
                    Ranked by quantity sold.
                  </p>
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
                      page={productsPage}
                      pageSize={DEFAULT_PAGE_SIZE}
                      totalItems={data.topProducts.length}
                      onPageChange={setProductsPage}
                    />
                  </>
                )}
              </div>

              <div className="min-w-0 overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-[var(--shadow-card)]">
                <div className="border-b border-[var(--border-soft)] p-4">
                  <h3 className="font-semibold text-[var(--charcoal-900)]">
                    Expenses by category
                  </h3>
                  <p className="mt-1 text-sm text-[var(--charcoal-500)]">
                    Expense value grouped by category.
                  </p>
                </div>

                {data.expenseCategories.length === 0 ? (
                  <div className="p-6 sm:p-8">
                    <EmptyState
                      title="No expense categories"
                      hint="No expense categories found for this period."
                    />
                  </div>
                ) : (
                  <>
                    <DataTable
                      columns={expenseCategoryColumns}
                      rows={paginatedExpenseCategories}
                      rowKey={(category) => category.category_id}
                      emptyMessage="No expense categories found."
                    />
                    <Pagination
                      page={categoriesPage}
                      pageSize={DEFAULT_PAGE_SIZE}
                      totalItems={data.expenseCategories.length}
                      onPageChange={setCategoriesPage}
                    />
                  </>
                )}
              </div>
            </div>
          </section>

          {refreshing && (
            <p
              role="status"
              className="text-right text-xs text-[var(--charcoal-500)]"
            >
              Updating report data...
            </p>
          )}
        </div>
      ) : (
        !error && (
          <div className="rounded-xl border border-[var(--border)] bg-white p-6 shadow-[var(--shadow-card)] sm:p-8">
            <EmptyState
              title="No report data available"
              hint="Try refreshing or selecting another date range."
              action={
                <Button onClick={() => void loadReports(true)}>
                  Reload reports
                </Button>
              }
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
    <div className="mb-3.5 sm:mb-4">
      <h2 className="font-semibold text-[var(--charcoal-900)]">{title}</h2>
      <p className="mt-1 text-sm text-[var(--charcoal-500)]">{description}</p>
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-soft)] bg-[var(--surface-muted)] p-3">
      <p className="text-xs font-medium text-[var(--charcoal-500)]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold tabular-nums text-[var(--charcoal-900)]">
        {typeof value === "number" ? formatNumber(value) : value}
      </p>
    </div>
  );
}