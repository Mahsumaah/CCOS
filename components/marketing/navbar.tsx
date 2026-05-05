"use client";

import * as React from "react";
import { Menu } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

import { CcosLogo } from "@/components/brand/ccos-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Link, usePathname } from "@/lib/i18n/routing";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navAnchors = [
  { href: "#features", key: "features" as const },
  { href: "#how-it-works", key: "howItWorks" as const },
  { href: "#pricing", key: "pricing" as const },
  { href: "#faq", key: "faq" as const },
];

function NavLinks({
  className,
  onNavigate,
}: {
  className?: string;
  onNavigate?: () => void;
}) {
  const t = useTranslations("marketing.nav");
  return (
    <nav className={cn("flex flex-col gap-1 md:flex-row md:items-center md:gap-8", className)}>
      {navAnchors.map(({ href, key }) => (
        <a
          key={key}
          href={href}
          className="text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
          onClick={onNavigate}
        >
          {t(key)}
        </a>
      ))}
    </nav>
  );
}

export function MarketingNavbar() {
  const t = useTranslations("marketing.nav");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const pathname = usePathname();

  const [scrolled, setScrolled] = React.useState(false);
  const [sheetOpen, setSheetOpen] = React.useState(false);

  React.useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 w-full transition-colors duration-300",
        scrolled
          ? "border-b border-border/80 bg-background/95 shadow-sm backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 md:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center"
          aria-label={tCommon("appName")}
        >
          <CcosLogo maxHeight={48} priority />
        </Link>

        <NavLinks className="mx-auto hidden lg:flex" />

        <div className="ms-auto flex items-center gap-2 md:gap-3">
          <ThemeToggle className="text-foreground shrink-0" />
          <div className="hidden items-center rounded-md border border-border/80 bg-background/60 p-0.5 lg:flex">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 min-w-9 px-2",
                locale === "ar" &&
                  "bg-primary font-medium text-primary-foreground shadow-sm",
              )}
              asChild
            >
              <Link href={pathname} locale="ar">
                AR
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(
                "h-8 min-w-9 px-2",
                locale === "en" &&
                  "bg-primary font-medium text-primary-foreground shadow-sm",
              )}
              asChild
            >
              <Link href={pathname} locale="en">
                EN
              </Link>
            </Button>
          </div>

          <div className="hidden items-center gap-2 lg:flex">
            <Button variant="outline" size="sm" className="font-medium" asChild>
              <Link href="/login">{t("signIn")}</Link>
            </Button>
            <Button
              size="sm"
              className="bg-primary font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
              asChild
            >
              <Link href="/register">{t("startFree")}</Link>
            </Button>
          </div>

          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="lg:hidden"
                aria-label={t("menu")}
              >
                <Menu className="size-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side={locale === "ar" ? "right" : "left"} className="w-[min(100vw-2rem,20rem)]">
              <SheetHeader>
                <SheetTitle className="text-start">{t("menu")}</SheetTitle>
              </SheetHeader>
              <div className="mt-6 flex flex-col gap-6">
                <div className="flex items-center justify-between gap-3 rounded-md border border-border/80 bg-muted/30 px-3 py-2">
                  <span className="text-muted-foreground text-sm font-medium">
                    {t("appearance")}
                  </span>
                  <ThemeToggle className="text-foreground shrink-0" />
                </div>
                <NavLinks
                  className="gap-4"
                  onNavigate={() => setSheetOpen(false)}
                />
                <div className="flex gap-2 rounded-md border p-1">
                  <Button
                    type="button"
                    variant={locale === "ar" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={pathname} locale="ar" onClick={() => setSheetOpen(false)}>
                      AR
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant={locale === "en" ? "default" : "ghost"}
                    size="sm"
                    className="flex-1"
                    asChild
                  >
                    <Link href={pathname} locale="en" onClick={() => setSheetOpen(false)}>
                      EN
                    </Link>
                  </Button>
                </div>
                <Button variant="outline" className="w-full font-medium" asChild>
                  <Link href="/login" onClick={() => setSheetOpen(false)}>
                    {t("signIn")}
                  </Link>
                </Button>
                <Button
                  className="w-full bg-primary font-semibold text-primary-foreground hover:bg-primary/90"
                  asChild
                >
                  <Link href="/register" onClick={() => setSheetOpen(false)}>
                    {t("startFree")}
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
