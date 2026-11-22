"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

import { clearToken, getToken } from "@/lib/auth";
import {
  fetchPermissions,
  getDefaultRoute,
  PermissionProvider,
  type PermissionResponse,
  usePermissions,
} from "@/lib/permissions";
import { Button, ErrorState } from "@/components";

import "../globals.css";

/* ------------------------------------------------------------------ */
/* Navigation config                                                   */
/* ------------------------------------------------------------------ */

type PermissionKey = Parameters<
  ReturnType<typeof usePermissions>["canView"]
>[0];

type NavItem = {
  href: string;
  label: string;
  permission: PermissionKey;
  badge?: string;
};

type NavGroup = {
  label?: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    items: [
      { href: "/dashboard", label: "Dashboard", permission: "dashboard" },
      {
        href: "/dashboard/ai",
        label: "AI Insights",
        permission: "ai",
        badge: "AI",
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/dashboard/products", label: "Products", permission: "products" },
      {
        href: "/dashboard/inventory",
        label: "Inventory",
        permission: "inventory",
      },
      { href: "/dashboard/sales", label: "Sales", permission: "sales" },
      {
        href: "/dashboard/receipts",
        label: "Receipts",
        permission: "purchases",
      },
      {
        href: "/dashboard/purchases",
        label: "Purchases",
        permission: "purchases",
      },
    ],
  },
  {
    label: "Business",
    items: [
      {
        href: "/dashboard/customers",
        label: "Customers",
        permission: "customers",
      },
      {
        href: "/dashboard/suppliers",
        label: "Suppliers",
        permission: "suppliers",
      },
      { href: "/dashboard/expenses", label: "Expenses", permission: "expenses" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/dashboard/reports", label: "Reports", permission: "reports" },
    ],
  },
  {
    label: "System",
    items: [
      { href: "/dashboard/settings", label: "Settings", permission: "settings" },
    ],
  },
];

const ALL_NAV_ITEMS = NAV_GROUPS.flatMap((group) => group.items);

function isActivePath(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

/*
- Faded, muted green gradient.
- Lower saturation than before, softer contrast, so the sidebar reads
- as "calm green" rather than "deep forest". Hover/active states are
- still legible because they use a light overlay, not a colour shift.
 */
const SIDEBAR_BACKGROUND =
  "linear-gradient(180deg, #293D2D 0%, #243428 100%)";

/* ------------------------------------------------------------------ */
/* Layout: auth + permission bootstrap (logic unchanged)               */
/* ------------------------------------------------------------------ */

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [collapsed, setCollapsed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [permissions, setPermissions] = useState<PermissionResponse | null>(
    null,
  );
  const [permissionError, setPermissionError] = useState("");

  // Bootstrap once on mount.
  useEffect(() => {
    let cancelled = false;

    async function initializeDashboard() {
      const token = getToken();

      if (!token) {
        router.replace(`/login?next=${encodeURIComponent(pathname)}`);
        return;
      }

      try {
        setPermissionError("");

        const permissionData = await fetchPermissions(token);

        if (cancelled) return;

        setPermissions(permissionData);
      } catch (error) {
        if (cancelled) return;

        setPermissionError(
          error instanceof Error
            ? error.message
            : "Unable to load your permissions.",
        );
      } finally {
        if (!cancelled) {
          setCheckingAuth(false);
        }
      }
    }

    initializeDashboard();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reactive redirect guard.
  useEffect(() => {
    if (!permissions) return;

    if (
      pathname === "/dashboard" &&
      !permissions.permissions.dashboard?.includes("view")
    ) {
      router.replace(getDefaultRoute(permissions));
    }
  }, [pathname, permissions, router]);

  const handleLogout = () => {
    clearToken();
    router.replace("/login");
  };

  if (checkingAuth) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--workspace)] px-4">
        <div className="flex flex-col items-center text-center">
          <h1 className="mt-4 text-lg font-semibold tracking-tight text-[var(--charcoal-900)]">
            BuildOps
          </h1>

          <div className="mt-3 flex items-center gap-2 text-sm text-[var(--charcoal-500)]">
            <span
              aria-hidden
              className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[var(--emerald-200)] border-t-[var(--emerald-600)]"
            />
            Checking your session...
          </div>
        </div>
      </main>
    );
  }

  if (permissionError || !permissions) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--workspace)] px-4 sm:px-6">
        <div className="w-full max-w-md space-y-5">
          <div className="flex flex-col items-center text-center">
            <h1 className="mt-4 text-lg font-semibold tracking-tight text-[var(--charcoal-900)]">
              BuildOps
            </h1>
          </div>

          <ErrorState
            title="Unable to load your permissions"
            message={
              permissionError ||
              "BuildOps could not verify your access rights. Please try again."
            }
          />

          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={() => window.location.reload()}>Try again</Button>

            <Button variant="outline" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <PermissionProvider value={permissions}>
      <DashboardShell
        collapsed={collapsed}
        setCollapsed={setCollapsed}
        handleLogout={handleLogout}
      >
        {children}
      </DashboardShell>
    </PermissionProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Shell                                                               */
/* ------------------------------------------------------------------ */

function DashboardShell({
  children,
  collapsed,
  setCollapsed,
  handleLogout,
}: {
  children: React.ReactNode;
  collapsed: boolean;
  setCollapsed: React.Dispatch<React.SetStateAction<boolean>>;
  handleLogout: () => void;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const currentSection =
    [...ALL_NAV_ITEMS]
      .sort((a, b) => b.href.length - a.href.length)
      .find((item) => isActivePath(pathname, item.href))?.label || "Dashboard";

  return (
    <div className="min-h-screen overflow-x-hidden bg-[var(--workspace)] text-[var(--charcoal-500)]">
      {/* Desktop sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 hidden flex-col transition-[width] duration-200 lg:flex ${
          collapsed ? "w-[64px]" : "w-[232px]"
        }`}
        style={{ background: SIDEBAR_BACKGROUND }}
      >
        <SidebarContent
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((current) => !current)}
          onLogout={handleLogout}
        />
      </aside>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[90] lg:hidden">
          <div
            className="absolute inset-0 bg-[#1a2620]/55 backdrop-blur-[3px]"
            onClick={() => setMobileOpen(false)}
          />

          <aside
            className="absolute inset-y-0 left-0 flex w-[260px] max-w-[85vw] flex-col shadow-2xl"
            style={{ background: SIDEBAR_BACKGROUND }}
            aria-label="Mobile navigation"
          >
            <SidebarContent
              collapsed={false}
              onLogout={handleLogout}
              onCloseMobile={() => setMobileOpen(false)}
            />
          </aside>
        </div>
      )}

      <main
        className={`flex min-h-screen min-w-0 flex-col transition-[padding] duration-200 ${
          collapsed ? "lg:pl-[64px]" : "lg:pl-[232px]"
        }`}
      >
        {/* Top bar */}
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 px-4 sm:px-6"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--charcoal-600)] transition hover:bg-[var(--surface-muted)] hover:text-[var(--charcoal-900)] lg:hidden"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M3 5h12M3 9h12M3 13h12"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </button>

            <div className="flex min-w-0 items-center gap-2 text-[13px]">
              <span className="hidden shrink-0 text-[var(--charcoal-400)] sm:inline">
                BuildOps
              </span>
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                className="hidden shrink-0 text-[var(--charcoal-300)] sm:block"
              >
                <path
                  d="M3.5 2 6.5 5 3.5 8"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="truncate font-medium text-[var(--charcoal-900)]">
                {currentSection}
              </span>
            </div>
          </div>

          <div className="shrink-0 lg:hidden">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </header>

        <div className="mx-auto w-full min-w-0 max-w-[1600px] flex-1 px-4 py-5 sm:px-6 sm:py-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sidebar pieces                                                      */
/* ------------------------------------------------------------------ */

function SidebarContent({
  collapsed,
  onToggleCollapse,
  onLogout,
  onCloseMobile,
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onLogout: () => void;
  onCloseMobile?: () => void;
}) {
  return (
    <>
      {/* Subtle top-edge illumination */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-px"
        style={{
          background:
            "linear-gradient(90deg, transparent, rgba(255,255,255,0.14), transparent)",
        }}
      />

      {/* Brand + collapse control */}
      <div
        className={`flex h-14 shrink-0 items-center ${
          collapsed ? "justify-center px-2" : "justify-between px-4"
        }`}
      >
        <BuildOpsLogo collapsed={collapsed} />

        {!collapsed && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/45 transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M8.5 3.5 5 7l3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close navigation menu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/55 transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="m3.5 3.5 7 7M10.5 3.5l-7 7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>

      {collapsed && onToggleCollapse && (
        <div className="flex justify-center pb-2">
          <button
            type="button"
            onClick={onToggleCollapse}
            aria-label="Expand sidebar"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/45 transition hover:bg-white/[0.08] hover:text-white"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5.5 3.5 9 7l-3.5 3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      )}

      <Navigation collapsed={collapsed} />

      {/* Logout */}
      <div
        className="mt-auto shrink-0 p-2.5"
        style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
      >
        <button
          type="button"
          onClick={onLogout}
          title={collapsed ? "Logout" : undefined}
          aria-label="Logout"
          className={`flex h-8 w-full items-center rounded-md text-[13px] text-white/65 transition hover:bg-white/[0.06] hover:text-white ${
            collapsed ? "justify-center px-2" : "px-3"
          }`}
        >
          {!collapsed && <span>Logout</span>}
          {collapsed && (
            <span className="text-[11px] font-semibold">⎋</span>
          )}
        </button>
      </div>
    </>
  );
}

function BuildOpsLogo({ collapsed }: { collapsed: boolean }) {
  const { canView } = usePermissions();

  const destination = canView("dashboard")
    ? "/dashboard"
    : canView("sales")
      ? "/dashboard/sales"
      : canView("inventory")
        ? "/dashboard/inventory"
        : canView("products")
          ? "/dashboard/products"
          : "/dashboard";

  return (
    <Link
      href={destination}
      title="BuildOps"
      className="flex min-w-0 items-center gap-2.5"
    >
      {!collapsed && (
        <div className="min-w-0 leading-none">
          <div className="truncate text-[13.5px] font-semibold tracking-tight text-white">
            BuildOps Min Min
          </div>
        </div>
      )}
    </Link>
  );
}

function Navigation({ collapsed }: { collapsed: boolean }) {
  const { canView } = usePermissions();

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canView(item.permission)),
  })).filter((group) => group.items.length > 0);

  return (
    <nav
      aria-label="Main navigation"
      className="flex-1 overflow-y-auto px-2.5 pb-3"
    >
      {visibleGroups.map((group, index) => (
        <div
          key={group.label ?? `group-${index}`}
          className={index > 0 ? "mt-1" : ""}
        >
          {group.label && (
            <SectionLabel collapsed={collapsed}>{group.label}</SectionLabel>
          )}

          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}

function SectionLabel({
  children,
  collapsed,
}: {
  children: ReactNode;
  collapsed: boolean;
}) {
  if (collapsed) {
    return (
      <div className="my-3 flex justify-center">
        <div className="h-px w-5 bg-white/12" />
      </div>
    );
  }

  return (
    <div className="px-3 pb-1.5 pt-4 text-[10.5px] font-medium uppercase tracking-wider text-white/40">
      {children}
    </div>
  );
}

function NavLink({
  item,
  collapsed,
}: {
  item: NavItem;
  collapsed: boolean;
}) {
  const pathname = usePathname();
  const active = isActivePath(pathname, item.href);

  return (
    <Link
      href={item.href}
      prefetch
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={`bo-transition group relative flex h-8 items-center rounded-md text-[13px] ${
        collapsed ? "justify-center px-2" : "px-3"
      } ${
        active
          ? "bg-white/[0.10] text-white"
          : "text-white/65 hover:bg-white/[0.06] hover:text-white"
      }`}
    >
      {/* Active left rail */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r bg-white/85"
        />
      )}

      {!collapsed && (
        <>
          <span className="min-w-0 flex-1 truncate">{item.label}</span>

          {item.badge && (
            <span className="rounded border border-white/20 px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-white/60">
              {item.badge}
            </span>
          )}
        </>
      )}

      {collapsed && (
        <span className="text-[10px] font-semibold uppercase tracking-wide">
          {item.label.slice(0, 2)}
        </span>
      )}
    </Link>
  );
}