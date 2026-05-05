import "./globals.css";

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "404 | CCOS",
};

export default function RootNotFound() {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-background text-foreground flex min-h-svh flex-col items-center justify-center gap-8 px-4 py-16 antialiased">
        <p className="text-primary text-7xl font-black tabular-nums tracking-tight sm:text-8xl">
          404
        </p>
        <div className="max-w-md space-y-2 text-center">
          <h1 className="text-xl font-semibold sm:text-2xl" dir="rtl">
            الصفحة غير موجودة
          </h1>
          <p className="text-muted-foreground text-lg font-medium sm:text-xl" dir="ltr">
            Page Not Found
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/ar"
            className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-w-[200px] items-center justify-center rounded-md px-6 py-3 text-center text-sm font-semibold transition-colors"
          >
            <span className="flex flex-col leading-tight">
              <span dir="rtl">العودة للرئيسية</span>
              <span className="text-xs font-normal opacity-90" dir="ltr">
                Home (AR)
              </span>
            </span>
          </Link>
          <Link
            href="/en"
            className="border-input bg-background hover:bg-accent inline-flex min-w-[200px] items-center justify-center rounded-md border px-6 py-3 text-center text-sm font-semibold transition-colors"
          >
            <span className="flex flex-col leading-tight">
              <span dir="ltr">Back to Home</span>
              <span className="text-muted-foreground text-xs font-normal" dir="rtl">
                الرئيسية (EN)
              </span>
            </span>
          </Link>
        </div>
      </body>
    </html>
  );
}
