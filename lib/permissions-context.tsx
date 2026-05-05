"use client";

import * as React from "react";

import type { EffectivePermissions } from "@/lib/rbac";

const PermissionsContext = React.createContext<EffectivePermissions | null>(
  null,
);

export function PermissionsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: EffectivePermissions;
}) {
  return (
    <PermissionsContext.Provider value={value}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions(): EffectivePermissions {
  const ctx = React.useContext(PermissionsContext);
  if (!ctx) {
    throw new Error("usePermissions must be used within PermissionsProvider");
  }
  return ctx;
}
