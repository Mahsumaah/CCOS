import { cn } from "@/lib/utils";

type CcosLogoProps = {
  className?: string;
  /** Approximate cap height for the wordmark (px) */
  maxHeight?: number;
  /** Kept for API compatibility */
  priority?: boolean;
};

/**
 * Wordmark: HTML text with `dir="ltr"` so it stays visible in RTL layouts (SVG
 * `<text>` can mis-render). Light mode uses dark ink; dark mode uses white.
 */
export function CcosLogo({ className, maxHeight = 44, priority: _p }: CcosLogoProps) {
  const fontPx = Math.max(20, Math.round(maxHeight * 0.58));

  return (
    <span
      dir="ltr"
      translate="no"
      className={cn(
        "inline-block shrink-0 select-none font-black tracking-tight text-zinc-900 dark:text-white",
        className,
      )}
      style={{ fontSize: fontPx, lineHeight: 1.05 }}
      role="img"
      aria-label="CCOS"
    >
      CCOS
    </span>
  );
}
