"use client";

import { useTranslations } from "next-intl";

import { CcosLogo } from "@/components/brand/ccos-logo";
import { cn } from "@/lib/utils";

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className="text-sm text-gray-400 transition-colors hover:text-white"
    >
      {children}
    </a>
  );
}

export function MarketingFooter() {
  const t = useTranslations("marketing.footer");

  return (
    <footer
      id="footer"
      className={cn(
        "mt-auto border-t border-white/10 text-gray-100",
        "bg-[#111827]",
      )}
    >
      <div className="mx-auto max-w-6xl px-4 py-14 md:px-6">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-3">
            <div className="brightness-0 invert">
              <CcosLogo maxHeight={40} />
            </div>
            <p className="text-muted-foreground max-w-xs text-sm leading-relaxed">
              {t("tagline")}
            </p>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-white">
              {t("colProduct")}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <FooterLink href="#features">{t("features")}</FooterLink>
              </li>
              <li>
                <FooterLink href="#pricing">{t("pricing")}</FooterLink>
              </li>
              <li>
                <FooterLink href="#faq">{t("faq")}</FooterLink>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-white">
              {t("colCompany")}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <FooterLink href="#">{t("about")}</FooterLink>
              </li>
              <li>
                <FooterLink href="mailto:hello@ccos.app">{t("contact")}</FooterLink>
              </li>
            </ul>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold tracking-wide text-white">
              {t("colLegal")}
            </h3>
            <ul className="flex flex-col gap-2">
              <li>
                <FooterLink href="#">{t("privacy")}</FooterLink>
              </li>
              <li>
                <FooterLink href="#">{t("terms")}</FooterLink>
              </li>
            </ul>
          </div>
        </div>
        <div className="text-muted-foreground mt-12 border-t border-white/10 pt-8 text-center text-xs">
          {t("copyright")}
        </div>
      </div>
    </footer>
  );
}
