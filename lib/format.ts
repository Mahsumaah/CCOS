import { format, formatDistanceToNow } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";

export type FormatLocale = "ar" | "en";

function dateFnsLocale(locale: FormatLocale) {
  return locale === "ar" ? arLocale : enUS;
}

function toDate(date: Date | number | string): Date {
  return date instanceof Date ? date : new Date(date);
}

export function formatDateTime(
  date: Date | number | string,
  locale: FormatLocale,
) {
  return format(toDate(date), "PPp", { locale: dateFnsLocale(locale) });
}

export function formatDate(
  date: Date | number | string,
  locale: FormatLocale,
) {
  return format(toDate(date), "PP", { locale: dateFnsLocale(locale) });
}

export function formatTime(
  date: Date | number | string,
  locale: FormatLocale,
) {
  return format(toDate(date), "p", { locale: dateFnsLocale(locale) });
}

export function formatDuration(minutes: number, locale: FormatLocale) {
  const num = new Intl.NumberFormat(
    locale === "ar" ? "ar-u-nu-arab" : "en",
    { maximumFractionDigits: 0 },
  ).format(minutes);

  if (locale === "ar") {
    return `${num} دقيقة`;
  }

  return `${num} ${minutes === 1 ? "minute" : "minutes"}`;
}

export function formatRelativeTime(
  date: Date | number | string,
  locale: FormatLocale,
) {
  return formatDistanceToNow(toDate(date), {
    addSuffix: true,
    locale: dateFnsLocale(locale),
  });
}

export function formatFileSize(bytes: number | null | undefined, locale: FormatLocale) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return locale === "ar" ? "—" : "—";
  }
  const units =
    locale === "ar"
      ? ["بايت", "ك.ب", "م.ب", "ج.ب", "ت.ب"]
      : ["B", "KB", "MB", "GB", "TB"];
  let n = bytes;
  let u = 0;
  while (n >= 1024 && u < units.length - 1) {
    n /= 1024;
    u += 1;
  }
  const nf = new Intl.NumberFormat(locale === "ar" ? "ar-u-nu-arab" : "en", {
    maximumFractionDigits: u === 0 ? 0 : 1,
  });
  return `${nf.format(n)} ${units[u]}`;
}
