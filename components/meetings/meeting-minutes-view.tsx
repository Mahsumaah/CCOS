"use client";

import type { MeetingStatus, Plan } from "@prisma/client";
import { useTranslations } from "next-intl";

import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { MinutesTab } from "@/components/meetings/MinutesTab";

export function MeetingMinutesView({
  meetingId,
  meetingTitle,
  meetingStatus,
  locale,
  currentUserId,
  tenantPlan = "TRIAL",
}: {
  meetingId: string;
  meetingTitle: string;
  meetingStatus: MeetingStatus;
  locale: "ar" | "en";
  currentUserId: string;
  tenantPlan?: Plan;
}) {
  const tNav = useTranslations("nav");
  const tMeetings = useTranslations("meetings");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12">
      <DashboardBreadcrumbs
        items={[
          { href: "/dashboard", label: tNav("dashboard") },
          { href: "/meetings", label: tNav("meetings") },
          { href: `/meetings/${meetingId}`, label: meetingTitle },
          { label: tMeetings("breadcrumbMinutes") },
        ]}
      />

      <MinutesTab
        meetingId={meetingId}
        currentUserId={currentUserId}
        locale={locale}
        meetingStatus={meetingStatus}
        tenantPlan={tenantPlan}
      />
    </div>
  );
}
