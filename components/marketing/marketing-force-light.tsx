"use client";

import * as React from "react";
import { useTheme } from "next-themes";

const STORAGE_KEY = "theme";

/**
 * Marketing (home, pricing) is light-only: forces `light` while mounted and
 * restores the prior `next-themes` value from localStorage on leave.
 */
export function MarketingForceLight({ children }: { children: React.ReactNode }) {
  const { setTheme } = useTheme();

  React.useEffect(() => {
    let previous: string | null = null;
    try {
      previous = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      previous = null;
    }
    setTheme("light");

    return () => {
      if (previous === "dark" || previous === "light" || previous === "system") {
        setTheme(previous);
      } else {
        setTheme("system");
      }
    };
  }, [setTheme]);

  return <>{children}</>;
}
