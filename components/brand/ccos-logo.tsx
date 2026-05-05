import Image from "next/image";

import { cn } from "@/lib/utils";

/** `sidebar`: always white. `marketing`: light shell — original asset. `auth`: light/dark app shell. */
export type CcosLogoAppearance = "sidebar" | "marketing" | "auth";

type CcosLogoProps = {
  className?: string;
  /** Max height in px (width scales) */
  maxHeight?: number;
  priority?: boolean;
  appearance?: CcosLogoAppearance;
};

/**
 * Brand mark: `/public/ccos-logo.png` only.
 * - Sidebar: forced white (invert) in light and dark theme.
 * - Marketing: natural colors (marketing layout is light-only).
 * - Auth: natural in light; white in dark when the app shell is dark.
 */
export function CcosLogo({
  className,
  maxHeight = 44,
  priority,
  appearance = "marketing",
}: CcosLogoProps) {
  const filterClass =
    appearance === "sidebar"
      ? "brightness-0 invert"
      : appearance === "marketing"
        ? ""
        : "dark:brightness-0 dark:invert";

  return (
    <Image
      src="/ccos-logo.png"
      alt="CCOS"
      width={240}
      height={80}
      priority={priority}
      className={cn("h-auto w-auto object-contain", filterClass, className)}
      style={{ maxHeight: `${maxHeight}px`, width: "auto" }}
    />
  );
}
