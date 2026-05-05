import type { ReactNode } from "react";

/**
 * Root layout delegates `<html>` / `<body>` to `app/[locale]/layout.tsx`
 * (next-intl + locale-aware `dir` for RTL).
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
