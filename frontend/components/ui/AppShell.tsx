"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type NavItem = {
  href: string;
  label: string;
  icon: React.ReactNode;
  group: "operate" | "intelligence";
};

/* Inline SVG icons — 16px, currentColor, matched stroke weight.
   No icon library dependency; every icon visually belongs to the same set. */
const Icon = {
  Grid: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
      <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Box: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 5.5 8 2.5l5.5 3v5L8 13.5l-5.5-3v-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M2.5 5.5 8 8.5l5.5-3M8 8.5v5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  ),
  Receipt: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M3 2.5h10v11l-2-1.2-2 1.2-2-1.2-2 1.2-2-1.2V2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M5.5 6h5M5.5 8.5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  Truck: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M1.5 4.5h8v6h-8v-6ZM9.5 6.5h3l2 2v2h-5v-4Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="4" cy="11.5" r="1.3" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="11" cy="11.5" r="1.3" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  Chart: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M2.5 13.5V7M7 13.5V3M11.5 13.5V9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  Sparkle: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 1.5 9.2 6 13.5 7.2 9.2 8.4 8 13 6.8 8.4 2.5 7.2 6.8 6 8 1.5Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  ),
  Menu: (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M3 5h12M3 9h12M3 13h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
  Close: (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  ),
};

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: Icon.Grid, group: "operate" },
  { href: "/inventory", label: "Inventory", icon: Icon.Box, group: "operate" },
  { href: "/orders", label: "Orders", icon: Icon.Receipt, group: "operate" },
  { href: "/suppliers", label: "Suppliers", icon: Icon.Truck, group: "operate" },
  { href: "/reports", label: "Reports", icon: Icon.Chart, group: "intelligence" },
  { href: "/assistant", label: "Assistant", icon: Icon.Sparkle, group: "intelligence" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const operate = NAV.filter((n) => n.group === "operate");
  const intelligence = NAV.filter((n) => n.group === "intelligence");

  const currentNav = NAV.find((item) => pathname?.startsWith(item.href));
  const currentLabel = currentNav?.label ?? "Dashboard";

  /* Close drawer on route change */
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  /* Close drawer on Escape & lock background scroll when open on mobile */
  useEffect(() => {
    if (!mobileNavOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [mobileNavOpen]);

  return (
    <div
      className="min-h-dvh flex w-full overflow-x-clip"
      style={{ background: "var(--workspace)" }}
    >
      {/* ══════════════ Mobile Backdrop ══════════════ */}
      {mobileNavOpen && (
        <div
          aria-hidden="true"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-[1px] lg:hidden"
        />
      )}

      {/* ══════════════ Sidebar (Drawer on <lg, Static on lg+) ══════════════ */}
      <aside
        aria-label="Primary navigation"
        className={`fixed inset-y-0 left-0 z-40 w-[248px] lg:w-[232px] shrink-0 flex flex-col transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
        }`}
        style={{
          background:
            "linear-gradient(180deg, var(--forest-900) 0%, var(--forest-950) 100%)",
        }}
      >
        {/* Subtle top-edge illumination */}
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-px"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(78,207,148,0.35), transparent)",
          }}
        />

        {/* ── Brand + Mobile Close ── */}
        <div className="px-5 pt-5 pb-5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="h-7 w-7 rounded-md grid place-items-center shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--emerald-500), var(--emerald-700))",
                boxShadow:
                  "0 0 0 1px rgba(78,207,148,0.15), 0 2px 8px rgba(0,0,0,0.25)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path
                  d="M2.5 11.5V5.5L7 3l4.5 2.5v6L7 14l-4.5-2.5Z"
                  stroke="white"
                  strokeWidth="1.3"
                  strokeLinejoin="round"
                  fill="none"
                />
                <path
                  d="M7 3v11"
                  stroke="white"
                  strokeWidth="1.3"
                  strokeLinecap="round"
                  opacity="0.6"
                />
              </svg>
            </div>
            <div className="leading-none min-w-0">
              <div className="text-[13.5px] font-semibold text-white tracking-tight truncate">
                BuildOps
              </div>
              <div className="text-[10.5px] text-white/40 mt-1 tracking-wide truncate">
                OPERATIONS OS
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Close navigation menu"
            className="lg:hidden grid h-8 w-8 place-items-center rounded-md text-white/60 hover:bg-white/[0.06] hover:text-white"
          >
            {Icon.Close}
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 px-2.5 pb-3 overflow-y-auto">
          <GroupLabel>Operate</GroupLabel>
          <div className="space-y-0.5 mb-5">
            {operate.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname?.startsWith(item.href) ?? false}
                onSelect={() => setMobileNavOpen(false)}
              />
            ))}
          </div>

          <GroupLabel>Intelligence</GroupLabel>
          <div className="space-y-0.5">
            {intelligence.map((item) => (
              <NavLink
                key={item.href}
                item={item}
                active={pathname?.startsWith(item.href) ?? false}
                onSelect={() => setMobileNavOpen(false)}
              />
            ))}
          </div>
        </nav>

        {/* ── Footer / user ── */}
        <div
          className="px-3 py-3 mt-auto"
          style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
        >
          <button
            type="button"
            className="bo-transition w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.04] text-left"
          >
            <div
              className="h-7 w-7 rounded-full grid place-items-center text-[10.5px] font-semibold text-white shrink-0"
              style={{
                background:
                  "linear-gradient(135deg, var(--forest-700), var(--forest-600))",
                boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.06)",
              }}
            >
              QN
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-white/90 truncate font-medium">
                Qnamr
              </div>
              <div className="text-[10.5px] text-white/40 truncate">
                Administrator
              </div>
            </div>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              fill="none"
              className="text-white/30 shrink-0"
            >
              <path
                d="M3 4.5 6 7.5 9 4.5"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </aside>

      {/* ══════════════ Main ══════════════ */}
      <main className="flex-1 min-w-0 flex flex-col">
        {/* Topbar */}
        <header
          className="h-14 px-4 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-20"
          style={{
            background: "rgba(255,255,255,0.88)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <div className="flex items-center gap-2.5 min-w-0 text-[13px]">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open navigation menu"
              aria-expanded={mobileNavOpen}
              className="lg:hidden -ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-md text-[var(--charcoal-700)] hover:bg-black/[0.04]"
            >
              {Icon.Menu}
            </button>

            <span
              className="hidden sm:inline shrink-0"
              style={{ color: "var(--charcoal-400)" }}
            >
              BuildOps
            </span>
            <svg
              width="10"
              height="10"
              viewBox="0 0 10 10"
              fill="none"
              className="hidden sm:inline shrink-0"
              style={{ color: "var(--charcoal-300)" }}
            >
              <path
                d="M3.5 2 6.5 5 3.5 8"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="truncate"
              style={{ color: "var(--charcoal-900)", fontWeight: 500 }}
            >
              {currentLabel}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Search — industrial, quiet */}
            <div
              className="hidden md:flex items-center gap-2 h-8 px-2.5 rounded-md w-56"
              style={{
                background: "var(--workspace)",
                border: "1px solid var(--border)",
              }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 13 13"
                fill="none"
                style={{ color: "var(--charcoal-400)" }}
              >
                <circle
                  cx="5.5"
                  cy="5.5"
                  r="3.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                />
                <path
                  d="m8.5 8.5 2.5 2.5"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
              <input
                placeholder="Search…"
                className="bg-transparent outline-none text-[12.5px] w-full placeholder:text-[color:var(--charcoal-400)]"
                style={{ color: "var(--charcoal-700)" }}
              />
            </div>

            <button
              type="button"
              className="bo-transition hidden sm:inline-flex items-center h-8 px-3 text-[12.5px] rounded-md font-medium"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                color: "var(--charcoal-700)",
              }}
            >
              Export
            </button>

            <button
              type="button"
              className="bo-transition inline-flex items-center h-8 px-2.5 sm:px-3 text-[12.5px] rounded-md font-medium text-white whitespace-nowrap"
              style={{
                background: "var(--emerald-600)",
                boxShadow: "0 1px 2px rgba(16,122,76,0.25)",
              }}
            >
              New Order
            </button>
          </div>
        </header>

        <div className="px-4 py-4 sm:px-6 sm:py-6 flex-1 min-w-0">
          {children}
        </div>
      </main>
    </div>
  );
}

/* ── Sidebar helpers ─────────────────────────────────────────── */

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-3 pt-2 pb-1.5 text-[10.5px] font-medium tracking-wider text-white/30 uppercase">
      {children}
    </div>
  );
}

function NavLink({
  item,
  active,
  onSelect,
}: {
  item: NavItem;
  active: boolean;
  onSelect?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onSelect}
      className="bo-transition group relative flex items-center gap-2.5 px-3 py-2 lg:py-1.5 rounded-md text-[13px]"
      style={
        active
          ? { background: "rgba(34,181,115,0.10)", color: "#ffffff" }
          : { color: "rgba(255,255,255,0.55)" }
      }
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background =
            "rgba(255,255,255,0.04)";
          (e.currentTarget as HTMLElement).style.color =
            "rgba(255,255,255,0.9)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          (e.currentTarget as HTMLElement).style.background = "transparent";
          (e.currentTarget as HTMLElement).style.color =
            "rgba(255,255,255,0.55)";
        }
      }}
    >
      {/* Active left rail — the only illumination marker in the whole nav */}
      {active && (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] rounded-r"
          style={{ background: "var(--emerald-400)" }}
        />
      )}
      <span
        className="shrink-0"
        style={{
          color: active ? "var(--emerald-300)" : "rgba(255,255,255,0.4)",
        }}
      >
        {item.icon}
      </span>
      <span className="truncate">{item.label}</span>
    </Link>
  );
}