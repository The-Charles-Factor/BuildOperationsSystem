"use client";

import {
  createContext,
  useContext,
  type ReactNode,
} from "react";

import { apiFetch } from "@/lib/api";

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "complete"
  | "payment"
  | "return"
  | "aggregate";

export type PermissionResource =
  | "dashboard"
  | "reports"
  | "ai"
  | "products"
  | "inventory"
  | "sales"
  | "purchases"
  | "customers"
  | "suppliers"
  | "expenses"
  | "settings"
  | "receipts"
  | "team";

export type BuildOpsRole =
  | "admin"
  | "manager"
  | "sales"
  | "inventory"
  | null;

export type PermissionResponse = {
  role: BuildOpsRole;
  permissions: Partial<
    Record<PermissionResource, PermissionAction[]>
  >;
};

type PermissionContextValue = PermissionResponse & {
  can: (
    resource: PermissionResource,
    action: PermissionAction,
  ) => boolean;
  canView: (resource: PermissionResource) => boolean;
  canCreate: (resource: PermissionResource) => boolean;
  canUpdate: (resource: PermissionResource) => boolean;
  canDelete: (resource: PermissionResource) => boolean;
};

const PermissionContext =
  createContext<PermissionContextValue | null>(null);

export function PermissionProvider({
  value,
  children,
}: {
  value: PermissionResponse;
  children: ReactNode;
}) {
  const can = (
    resource: PermissionResource,
    action: PermissionAction,
  ): boolean => {
    return (
      value.permissions[resource]?.includes(action) ?? false
    );
  };

  const contextValue: PermissionContextValue = {
    ...value,
    can,
    canView: (resource) => can(resource, "view"),
    canCreate: (resource) => can(resource, "create"),
    canUpdate: (resource) => can(resource, "update"),
    canDelete: (resource) => can(resource, "delete"),
  };

  return (
    <PermissionContext.Provider value={contextValue}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions(): PermissionContextValue {
  const context = useContext(PermissionContext);

  if (!context) {
    throw new Error(
      "usePermissions must be used inside PermissionProvider.",
    );
  }

  return context;
}

export async function fetchPermissions(
  token: string,
): Promise<PermissionResponse> {
  return apiFetch<PermissionResponse>(
    "/api/accounts/me/permissions/",
    {
      token,
    },
  );
}

/**
 * Determines the first page the authenticated user
 .. is allowed to access.
 *
 * Admins with dashboard:view go to the dashboard.
 * Other roles are directed to their most appropriate
  .. operational module
  operation modules
  operation modules
  operation modules and admines view the dashboard 
 */

export function getDefaultRoute(
  permissions: PermissionResponse,
): string {
  if (
    permissions.role === "admin" &&
    permissions.permissions.dashboard?.includes("view")
  ) {
    return "/dashboard";
  }

  if (permissions.permissions.sales?.includes("view")) {
    return "/dashboard/sales";
  }

  if (permissions.permissions.inventory?.includes("view")) {
    return "/dashboard/inventory";
  }

  if (permissions.permissions.products?.includes("view")) {
    return "/dashboard/products";
  }

  if (permissions.permissions.customers?.includes("view")) {
    return "/dashboard/customers";
  }

  if (permissions.permissions.receipts?.includes("view")) {
    return "/dashboard/receipts";
  }

  return "/login";
}