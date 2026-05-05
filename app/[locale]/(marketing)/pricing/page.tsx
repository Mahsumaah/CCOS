import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { MarketingPricingSection } from "@/components/marketing/marketing-pricing-section";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const loc = locale === "en" ? "en" : "ar";
  const t = await getTranslations({
    locale: loc,
    namespace: "marketing.pricing",
  });
  return {
    title: `${t("sectionTitle")} | CCOS`,
    description: t("sectionSubtitle"),
  };
}

export default function MarketingPricingPage() {
  return (
    <div className="py-16 md:py-24">
      <MarketingPricingSection showWhatIs />
    </div>
  );
}
