"use client";

import type { BoardUser, Meeting, MeetingStatus } from "@prisma/client";
import { ClipboardList, FilePlus, FileText, Users, Vote } from "lucide-react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { formatDateTime, formatDuration } from "@/lib/format";
import { getMeetingTypeLabel } from "@/lib/meeting-types";
import {
  getStatusBadgeClassName,
  getStatusLabel,
  getStatusVariant,
} from "@/lib/meeting-status";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

export type MeetingCardCounts = {
  agenda: number;
  invitations: number;
  votes: number;
  decisions: number;
};

export type MeetingForCard = Meeting & {
  createdBy: BoardUser;
  minutes?: { id: string } | null;
  _count?: MeetingCardCounts;
};

function CountChip({
  icon: Icon,
  value,
}: {
  icon: typeof ClipboardList;
  value: number;
}) {
  return (
    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs tabular-nums">
      <Icon className="size-3.5 shrink-0 opacity-80" aria-hidden />
      {value}
    </span>
  );
}

export function MeetingCard({
  meeting,
  locale,
}: {
  meeting: MeetingForCard;
  locale: "ar" | "en";
}) {
  const tMeetings = useTranslations("meetings");
  const badgeVariant = getStatusVariant(meeting.status);
  const badgeExtra = getStatusBadgeClassName(meeting.status);

  const counts = meeting._count ?? {
    agenda: 0,
    invitations: 0,
    votes: 0,
    decisions: 0,
  };

  const hasMinutes = Boolean(meeting.minutes);
  const showMinutesShortcut = (s: MeetingStatus) =>
    s === "ENDED" || s === "ARCHIVED";

  return (
    <Card className="h-full shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md motion-reduce:hover:translate-y-0">
      <Link
        href={`/meetings/${meeting.id}`}
        className="block transition-opacity hover:opacity-95"
      >
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="line-clamp-2 font-semibold leading-snug text-foreground">
              {meeting.title}
            </h3>
            <p className="text-muted-foreground text-sm">
              {formatDateTime(meeting.scheduledAt, locale)}
            </p>
            <p className="text-muted-foreground text-xs">
              {formatDuration(meeting.durationMin, locale)} ·{" "}
              {getMeetingTypeLabel(meeting.type, locale)}
            </p>
            <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 pt-1">
              <CountChip icon={ClipboardList} value={counts.agenda} />
              <CountChip icon={Users} value={counts.invitations} />
              <CountChip icon={Vote} value={counts.votes} />
              <CountChip icon={FileText} value={counts.decisions} />
            </div>
          </div>
          <Badge
            variant={badgeVariant}
            className={cn("shrink-0", badgeExtra)}
          >
            {getStatusLabel(meeting.status, locale)}
          </Badge>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-muted-foreground text-xs">
            {tMeetings("createdByLine", { name: meeting.createdBy.name })}
          </p>
        </CardContent>
      </Link>
      {showMinutesShortcut(meeting.status) ? (
        <CardContent className="border-border border-t pt-3">
          {hasMinutes ? (
            <Link
              href={`/meetings/${meeting.id}/minutes`}
              className="text-primary inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <FileText className="size-4 shrink-0" aria-hidden />
              {tMeetings("viewMinutesLink")}
            </Link>
          ) : (
            <Link
              href={`/meetings/${meeting.id}?tab=minutes`}
              className="text-primary inline-flex items-center gap-2 text-sm font-medium underline-offset-4 hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              <FilePlus className="size-4 shrink-0" aria-hidden />
              {tMeetings("generateMinutesLink")}
            </Link>
          )}
        </CardContent>
      ) : null}
    </Card>
  );
}
