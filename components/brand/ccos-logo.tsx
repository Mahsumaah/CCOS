import Image from "next/image";

import { cn } from "@/lib/utils";

type CcosLogoProps = {
  className?: string;
  /** Max height in px (width scales) */
  maxHeight?: number;
  priority?: boolean;
};

/**
 * Brand mark from `/public/ccos-1.png`. Add that asset to the repo if missing.
 */
export function CcosLogo({ className, maxHeight = 40, priority }: CcosLogoProps) {
  return (
    <Image
      src="/ccos-1.png"
      alt="CCOS"
      width={240}
      height={80}
      priority={priority}
      className={cn(
        "h-auto w-auto object-contain",
        /* Dark theme: PNG mark is dark-on-dark on sidebar/header — read as white */
        "dark:brightness-0 dark:invert",
        className,
      )}
      style={{ maxHeight: `${maxHeight}px` }}
    />
  );
}
