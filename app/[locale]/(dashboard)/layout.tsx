import type { Metadata } from "next";

import { auth } from "@/lib/auth";
import { redirect } from "@/lib/i18n/routing";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import { PlanUpgradeProvider } from "@/components/plan/plan-upgrade-provider";
import { PermissionsProvider } from "@/lib/permissions-context";
import { getEffectivePermissions } from "@/lib/rbac";
import {
  calculateQuorum,
  countQuorumAttendance,
} from "@/lib/meeting-quorum";
import { prisma } from "@/lib/prisma";
import { canManageTenantSettings } from "@/lib/tenant-settings-permission";

export const metadata: Metadata = {
  title: {
    template: "%s | CCOS",
    default: "CCOS",
  },
};

export default async function DashboardGroupLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();

  if (!session?.user) {
    redirect({ href: "/login", locale: locale as "ar" | "en" });
  }

  const authedUser = session!.user;

  const [tenantRow, liveMeeting] = await Promise.all([
    prisma.tenant.findUnique({
      where: { id: authedUser.tenantId },
      select: { name: true, logo: true, plan: true, trialEndsAt: true },
    }),
    prisma.meeting.findFirst({
      where: { tenantId: authedUser.tenantId, status: "LIVE" },
      select: {
        id: true,
        title: true,
        type: true,
        invitations: {
          select: {
            userId: true,
            status: true,
            attendanceCheckedInAt: true,
          },
        },
      },
    }),
  ]);

  let liveQuorum: {
    meetingId: string;
    title: string;
    quorum: ReturnType<typeof calculateQuorum>;
  } | null = null;

  if (liveMeeting) {
    const policy = await prisma.meetingTypeQuorumPolicy.findUnique({
      where: { meetingType: liveMeeting.type },
    });
    const activeDelegations = await prisma.meetingDelegation.findMany({
      where: { meetingId: liveMeeting.id, revokedAt: null },
      select: { fromUserId: true, toUserId: true, revokedAt: true },
    });
    liveQuorum = {
      meetingId: liveMeeting.id,
      title: liveMeeting.title,
      quorum: calculateQuorum({
        meetingType: liveMeeting.type,
        policy,
        totalInvited: liveMeeting.invitations.length,
        attendedCount: countQuorumAttendance(
          liveMeeting.invitations,
          activeDelegations,
        ),
      }),
    };
  }

  const permissions = getEffectivePermissions(authedUser);
  const showTenantSettingsNav = canManageTenantSettings(authedUser);

  return (
    <div
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      className="flex min-h-0 flex-1 flex-col"
    >
      <PermissionsProvider value={permissions}>
        <PlanUpgradeProvider locale={locale as "ar" | "en"}>
          <DashboardShell
            locale={locale as "ar" | "en"}
            liveQuorum={liveQuorum}
            user={{
              name: authedUser.name ?? null,
              email: authedUser.email ?? null,
              role: authedUser.role,
              tenantName: tenantRow?.name?.trim() || null,
              tenantLogo: tenantRow?.logo ?? null,
              canManageTenantSettings: showTenantSettingsNav,
              tenantPlan: tenantRow?.plan ?? "TRIAL",
              trialEndsAtIso: tenantRow?.trialEndsAt
                ? tenantRow.trialEndsAt.toISOString()
                : null,
            }}
          >
            {children}
          </DashboardShell>
        </PlanUpgradeProvider>
      </PermissionsProvider>
    </div>
  );
}
