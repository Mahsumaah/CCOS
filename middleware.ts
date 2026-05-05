import createMiddleware from "next-intl/middleware";
import { NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { routing } from "@/lib/i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * 1) next-intl locale routing (e.g. `/` → `/ar`).
 * 2) Public marketing home `/{locale}` (/) for guests; signed-in users on `/` → `/dashboard`.
 * 3) Auth: public `/login`, `/register`, `/login/set-password`, `/api/auth`; dashboard routes require a session;
 *    logged-in users on `/login` or `/register` → `/dashboard`.
 */
export default auth((req) => {
  const intlResponse = intlMiddleware(req);

  if (intlResponse.headers.has("location")) {
    return intlResponse;
  }

  const pathname = req.nextUrl.pathname;
  const localeMatch = pathname.match(/^\/(ar|en)(\/|$)/);
  const locale = (localeMatch?.[1] ?? routing.defaultLocale) as "ar" | "en";
  const restPath = localeMatch
    ? pathname.slice(`/${locale}`.length) || "/"
    : pathname;

  if (restPath === "/") {
    if (req.auth) {
      return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
    }
    return intlResponse;
  }

  const needsAuth =
    restPath.startsWith("/dashboard") ||
    restPath.startsWith("/meetings") ||
    restPath.startsWith("/notifications") ||
    restPath.startsWith("/users") ||
    restPath.startsWith("/settings") ||
    restPath.startsWith("/account");

  if (needsAuth && !req.auth) {
    const signInUrl = new URL(`/${locale}/login`, req.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  const isLoginEntry =
    restPath === "/login" ||
    restPath === "/register" ||
    (restPath.startsWith("/login/") &&
      !restPath.startsWith("/login/set-password"));

  if (req.auth && isLoginEntry) {
    return NextResponse.redirect(new URL(`/${locale}/dashboard`, req.url));
  }

  return intlResponse;
});

export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
