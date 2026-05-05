import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";

import { resolveLocaleParam } from "@/lib/locale-params";

const NAV_TITLE_KEYS = [
  "dashboard",
  "meetings",
  "notifications",
  "users",
  "positions",
  "quorumPolicies",
  "account",
  "settings",
] as const;

export type DashboardNavTitleKey = (typeof NAV_TITLE_KEYS)[number];

export async function dashboardNavMetadata(
  params: Promise<{ locale: string }> | undefined,
  titleKey: DashboardNavTitleKey,
): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace: "nav" });
  return { title: t(titleKey) };
}

export async function dashboardMetadataFromKey(
  params: Promise<{ locale: string }> | undefined,
  namespace: string,
  key: string,
): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  const t = await getTranslations({ locale, namespace });
  return { title: t(key) };
}
