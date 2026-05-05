import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import {
  MeetingMinutesDocumentView,
  type StandaloneSignature,
} from "@/components/meetings/meeting-minutes-document-view";
import { auth } from "@/lib/auth";
import { getRoleLabel } from "@/lib/board-roles";
import { redirect } from "@/lib/i18n/routing";
import { prisma } from "@/lib/prisma";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}): Promise<Metadata> {
  const { id, locale } = await params;
  const loc = locale === "en" ? "en" : "ar";
  const session = await auth();
  const t = await getTranslations({ locale: loc, namespace: "meetings" });
  const suffix = t("breadcrumbMinutes");
  if (!session?.user) {
    return { title: suffix };
  }
  const row = await prisma.meeting.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { title: true },
  });
  return { title: row?.title ? `${row.title} — ${suffix}` : suffix };
}

export default async function MeetingMinutesPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { id, locale } = await params;
  const session = await auth();

  if (!session?.user) {
    notFound();
  }

  const loc = locale === "en" ? "en" : "ar";

  const meeting = await prisma.meeting.findFirst({
    where: { id, tenantId: session.user.tenantId },
    select: { id: true, title: true },
  });

  if (!meeting) {
    notFound();
  }

  const minutesRow = await prisma.minutes.findUnique({
    where: { meetingId: id },
    include: {
      signatures: {
        include: {
          user: { select: { name: true, role: true } },
        },
        orderBy: { signedAt: "asc" },
      },
    },
  });

  if (!minutesRow) {
    redirect({ href: `/meetings/${id}`, locale: loc });
  }

  const minutes = minutesRow as NonNullable<typeof minutesRow>;

  const extraIds = [minutes.finalizedById, minutes.adoptedById].filter(
    (x): x is string => Boolean(x),
  );
  const extras =
    extraIds.length > 0
      ? await prisma.boardUser.findMany({
          where: { id: { in: extraIds } },
          select: { id: true, name: true },
        })
      : [];
  const nameBy = Object.fromEntries(extras.map((u) => [u.id, u.name]));

  const adopted =
    minutes.adoptedDocumentUrl && minutes.adoptedAt
      ? {
          url: minutes.adoptedDocumentUrl,
          name: minutes.adoptedDocumentName,
          mime: minutes.adoptedDocumentMime,
          size: minutes.adoptedDocumentSize,
          adoptedAt: minutes.adoptedAt.toISOString(),
          adoptedByName: minutes.adoptedById
            ? (nameBy[minutes.adoptedById] ?? null)
            : null,
        }
      : null;

  const signatures: StandaloneSignature[] = minutes.signatures.map((s) => ({
    id: s.id,
    userName: s.user.name,
    roleLabel: getRoleLabel(s.user.role, loc),
    signedAt: s.signedAt.toISOString(),
    typedName: s.typedName,
    signatureImageUrl: s.signatureImageUrl,
  }));

  return (
    <MeetingMinutesDocumentView
      meetingId={meeting.id}
      meetingTitle={meeting.title}
      locale={loc}
      contentHtml={minutes.contentHtml}
      adopted={adopted}
      signatures={signatures}
    />
  );
}
