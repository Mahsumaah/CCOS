import { routing } from "@/lib/i18n/routing";

type Locale = (typeof routing.locales)[number];

/**
 * Next.js 16 can omit `params` for some special routes (e.g. `not-found` under `[locale]`)
 * during static generation. Never destructure `locale` from `await params` without this guard.
 */
export async function resolveLocaleParam(
  params: Promise<{ locale: string }> | undefined,
): Promise<Locale> {
  if (!params) {
    return routing.defaultLocale;
  }
  const bag = await params;
  if (!bag?.locale || !routing.locales.includes(bag.locale as Locale)) {
    return routing.defaultLocale;
  }
  return bag.locale as Locale;
}
