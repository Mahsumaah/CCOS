import "../globals.css";

import type { Metadata } from "next";
import { Cairo, Montserrat } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

import Providers from "@/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { routing } from "@/lib/i18n/routing";
import { resolveLocaleParam } from "@/lib/locale-params";
import { cn } from "@/lib/utils";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "CCOS",
  description: "Board meetings management platform",
  icons: {
    icon: "/favicon.ico",
  },
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params?: Promise<{ locale: string }>;
}) {
  const locale = await resolveLocaleParam(params);

  if (!routing.locales.includes(locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      data-locale={locale}
      className={cn(cairo.variable, montserrat.variable)}
    >
      <body
        className={cn(
          locale === "ar" ? cairo.className : montserrat.className,
          "antialiased",
        )}
      >
        <NextIntlClientProvider messages={messages}>
          <Providers>
            {children}
            <Toaster />
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
