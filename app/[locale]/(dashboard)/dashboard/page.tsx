import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { getTranslations } from "next-intl/server";

import { dashboardNavMetadata } from "@/lib/dashboard-metadata";
import { CalendarDays, FileCheck, Plus, Vote } from "lucide-react";

import { MeetingCard } from "@/components/meetings/MeetingCard";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { auth } from "@/lib/auth";
import { Link, redirect } from "@/lib/i18n/routing";
import { prisma } from "@/lib/prisma";
import { getEffectivePermissions } from "@/lib/rbac";

const meetingCardInclude = {
  createdBy: true,
  minutes: { select: { id: true } },
  _count: {
    select: {
      agenda: true,
      invitations: true,
      votes: true,
      decisions: true,
    },
  },
} satisfies Prisma.MeetingInclude;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  return dashboardNavMetadata(params, "dashboard");
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const loc = locale as "ar" | "en";

  const session = await auth();
  if (!session?.user) {
    redirect({ href: "/login", locale: loc });
  }

  const user = session!.user;
  const tenantId = user.tenantId;
  const t = await getTranslations("dashboard");

  const now = new Date();

  const [
    totalMeetings,
    openVotesCount,
    openDecisionsCount,
    upcomingMeetings,
    recentMeetings,
  ] = await Promise.all([
    prisma.meeting.count({ where: { tenantId } }),
    prisma.vote.count({
      where: {
        isOpen: true,
        meeting: { tenantId },
      },
    }),
    prisma.decision.count({
      where: {
        status: { in: ["OPEN", "IN_PROGRESS"] },
        meeting: { tenantId },
      },
    }),
    prisma.meeting.findMany({
      where: {
        tenantId,
        OR: [
          { status: "LIVE" },
          { status: "SCHEDULED", scheduledAt: { gte: now } },
        ],
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
      include: meetingCardInclude,
    }),
    prisma.meeting.findMany({
      where: {
        tenantId,
        status: { in: ["ENDED", "ARCHIVED", "CANCELLED"] },
      },
      orderBy: { endedAt: { sort: "desc", nulls: "last" } },
      take: 5,
      include: meetingCardInclude,
    }),
  ]);

  const { canCreateMeetings } = getEffectivePermissions(user);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border-t-4 border-t-[#FFD200] shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardDescription className="font-medium">
                {t("totalMeetings")}
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {totalMeetings}
              </CardTitle>
            </div>
            <div className="rounded-md bg-[#FFD200]/15 p-2 text-[#b89600]">
              <CalendarDays className="size-5" aria-hidden />
            </div>
          </CardHeader>
          <CardContent />
        </Card>
        <Card className="border-t-4 border-t-[#0066FF] shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardDescription className="font-medium">
                {t("openVotes")}
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {openVotesCount}
              </CardTitle>
            </div>
            <div className="rounded-md bg-[#0066FF]/12 p-2 text-[#0066FF]">
              <Vote className="size-5" aria-hidden />
            </div>
          </CardHeader>
          <CardContent />
        </Card>
        <Card className="border-t-4 border-t-[#16a34a] shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
            <div className="space-y-1">
              <CardDescription className="font-medium">
                {t("openDecisions")}
              </CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums">
                {openDecisionsCount}
              </CardTitle>
            </div>
            <div className="rounded-md bg-[#16a34a]/12 p-2 text-[#15803d]">
              <FileCheck className="size-5" aria-hidden />
            </div>
          </CardHeader>
          <CardContent />
        </Card>
      </div>

      {canCreateMeetings ? (
        <div>
          <Button variant="default" asChild>
            <Link
              href="/meetings/new"
              locale={loc}
              className="bg-primary inline-flex items-center gap-2 px-6 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 active:scale-[0.98]"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {t("createMeeting")}
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-6">
        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {t("upcomingMeetings")}
          </h2>
          {upcomingMeetings.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <CalendarDays
                  className="text-muted-foreground size-10"
                  aria-hidden
                />
                <p className="text-muted-foreground text-sm">{t("noUpcoming")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {upcomingMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} locale={loc} />
              ))}
            </div>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <h2 className="text-lg font-semibold text-foreground">
            {t("recentMeetings")}
          </h2>
          {recentMeetings.length === 0 ? (
            <Card className="shadow-sm">
              <CardContent className="flex flex-col items-center justify-center gap-3 py-10 text-center">
                <CalendarDays
                  className="text-muted-foreground size-10"
                  aria-hidden
                />
                <p className="text-muted-foreground text-sm">{t("noRecent")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {recentMeetings.map((m) => (
                <MeetingCard key={m.id} meeting={m} locale={loc} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
