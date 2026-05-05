import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { getTranslations } from "next-intl/server";

import { dashboardNavMetadata } from "@/lib/dashboard-metadata";

import { UsersClient } from "@/components/users/UsersClient";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { adminBoardUserSelect, toAdminBoardUserJson } from "@/lib/admin-board-user";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/rbac";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return dashboardNavMetadata(params, "users");
}

export default async function UsersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale === "en" ? "en" : "ar";
  const t = await getTranslations({ locale: loc, namespace: "users" });

  const session = await auth();
  if (!session?.user) {
    return null;
  }

  const perms = getEffectivePermissions(session.user);
  if (!perms.canManageUsers) {
    return (
      <div className="mx-auto flex max-w-lg flex-1 flex-col justify-center p-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-muted">
              <Lock className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <CardTitle>{t("accessDeniedTitle")}</CardTitle>
            <CardDescription className="text-base">
              {t("accessDenied")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            {t("accessDeniedHint")}
          </CardContent>
        </Card>
      </div>
    );
  }

  const [userRows, positions] = await Promise.all([
    prisma.boardUser.findMany({
      where: { tenantId: session.user.tenantId },
      select: adminBoardUserSelect,
      orderBy: { name: "asc" },
    }),
    prisma.organizationalPosition.findMany({
      where: { isActive: true },
      select: { code: true, labelAr: true, labelEn: true },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  const initialUsers = userRows.map(toAdminBoardUserJson);

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <UsersClient
        locale={loc}
        currentUserId={session.user.id}
        initialUsers={initialUsers}
        positions={positions}
      />
    </div>
  );
}
