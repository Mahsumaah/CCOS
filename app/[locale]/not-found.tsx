import type { Metadata } from "next";

import { CcosLogo } from "@/components/brand/ccos-logo";
import { Button } from "@/components/ui/button";
import { Link } from "@/lib/i18n/routing";

export const metadata: Metadata = {
  title: "404",
};

export default async function LocaleNotFound({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale === "en" ? "en" : "ar";

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4 py-16 text-foreground">
      <Link href="/" locale={loc} className="shrink-0" aria-label="CCOS">
        <CcosLogo maxHeight={40} />
      </Link>
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-primary text-7xl font-black tabular-nums tracking-tight sm:text-8xl">
          404
        </p>
        <div className="space-y-1">
          <h1 className="text-xl font-semibold sm:text-2xl" dir="rtl">
            الصفحة غير موجودة
          </h1>
          <h1 className="text-muted-foreground text-lg font-medium sm:text-xl" dir="ltr">
            Page Not Found
          </h1>
        </div>
        <Button size="lg" className="mt-2 min-w-[220px] font-semibold" asChild>
          <Link
            href="/"
            locale={loc}
            className="flex flex-col gap-0.5 py-6 leading-tight"
          >
            <span dir="rtl">العودة للرئيسية</span>
            <span
              className="text-primary-foreground/85 text-xs font-normal"
              dir="ltr"
            >
              Back to Home
            </span>
          </Link>
        </Button>
      </div>
    </div>
  );
}
