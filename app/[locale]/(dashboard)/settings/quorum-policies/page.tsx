import { getTranslations } from "next-intl/server";

import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { QuorumPoliciesForm } from "@/components/settings/quorum-policies-form";
import { auth } from "@/lib/auth";
import { redirect } from "@/lib/i18n/routing";
import { getEffectivePermissions } from "@/lib/rbac";

export default async function QuorumPoliciesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale === "en" ? "en" : "ar";
  const session = await auth();
  const user = session?.user;

  if (!user) {
    redirect({ href: "/login", locale: loc });
    throw new Error("Unreachable");
  }

  const perms = getEffectivePermissions(user);
  if (!perms.canManageQuorumPolicies) {
    redirect({ href: "/dashboard", locale: loc });
  }

  const t = await getTranslations("quorumPolicies");
  const tNav = await getTranslations("nav");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <DashboardBreadcrumbs
        items={[
          { label: tNav("dashboard"), href: "/dashboard" },
          { label: tNav("settings"), href: "/settings" },
          { label: t("pageTitle") },
        ]}
      />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-1 text-sm">{t("pageSubtitle")}</p>
      </div>
      <QuorumPoliciesForm locale={loc} />
    </div>
  );
}
