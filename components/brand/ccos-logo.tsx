import { cn } from "@/lib/utils";

type CcosLogoProps = {
  className?: string;
  /** Height in px; width follows aspect ratio */
  maxHeight?: number;
  /** Kept for API compatibility (no image LCP) */
  priority?: boolean;
};

/**
 * Vector wordmark — no external PNG required. Uses `currentColor` so it follows
 * light/dark foreground and stays visible on any header/sidebar background.
 */
export function CcosLogo({ className, maxHeight = 44, priority: _p }: CcosLogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 156 36"
      fill="currentColor"
      className={cn("block shrink-0 text-foreground", className)}
      style={{
        height: maxHeight,
        width: "auto",
        minHeight: 28,
        minWidth: 72,
      }}
      role="img"
      aria-label="CCOS"
    >
      <title>CCOS</title>
      <text
        x="0"
        y="28"
        fontSize="30"
        fontWeight="800"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="-0.04em"
      >
        CCOS
      </text>
    </svg>
  );
}
