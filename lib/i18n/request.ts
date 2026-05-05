import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;

  if (!locale || !routing.locales.includes(locale as "ar" | "en")) {
    locale = routing.defaultLocale;
  }

  const base = (await import(`@/messages/${locale}.json`)).default;
  const marketing = (
    await import(`@/messages/marketing-${locale}.json`)
  ).default;

  return {
    locale,
    messages: { ...base, marketing },
  };
});
