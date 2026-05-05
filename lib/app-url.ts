/** Public site origin for absolute links (no trailing slash). */
export function getPublicAppUrl(): string {
  const next = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, "");
  if (next) return next;
  const vercel = process.env.VERCEL_URL?.trim().replace(/\/$/, "");
  if (vercel) {
    return vercel.startsWith("http") ? vercel : `https://${vercel}`;
  }
  return "http://localhost:3000";
}

export function absoluteAppUrl(locale: "ar" | "en", path: string): string {
  const base = getPublicAppUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}/${locale}${p}`;
}
