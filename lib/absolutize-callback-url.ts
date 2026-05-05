/**
 * Use with `signOut({ callbackUrl })` on the client so the post-logout redirect
 * stays on the current deployment host. A relative path can be resolved against
 * a wrong `NEXTAUTH_URL` (e.g. localhost) on the server in production.
 */
export function absolutizeCallbackUrl(path: string): string {
  if (typeof window === "undefined") return path;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${window.location.origin}${p}`;
}
