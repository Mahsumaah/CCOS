"use client";

import * as React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";

export function ThemeToggle({ className }: { className?: string }) {
  const { resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("common");
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const next = resolvedTheme === "dark" ? "light" : "dark";
  const label =
    resolvedTheme === "dark" ? t("themeUseLight") : t("themeUseDark");

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={className}
      title={label}
      aria-label={label}
      disabled={!mounted}
      onClick={() => setTheme(next)}
    >
      {!mounted ? (
        <Sun className="size-5 opacity-50" aria-hidden />
      ) : resolvedTheme === "dark" ? (
        <Sun className="size-5" aria-hidden />
      ) : (
        <Moon className="size-5" aria-hidden />
      )}
    </Button>
  );
}
