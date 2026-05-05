"use client";

import { CalendarPlus } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Link } from "@/lib/i18n/routing";

export function MeetingsEmptyWelcome({
  canCreateMeetings,
}: {
  canCreateMeetings: boolean;
}) {
  const t = useTranslations("meetings");

  return (
    <Card className="border-dashed shadow-sm">
      <CardHeader className="items-center space-y-2 pb-2 text-center">
        <div className="bg-muted text-muted-foreground flex size-20 items-center justify-center rounded-2xl border border-dashed">
          <CalendarPlus className="size-10" aria-hidden />
        </div>
        <CardTitle className="text-xl">{t("emptyWelcomeTitle")}</CardTitle>
        <CardDescription className="max-w-md text-balance">
          {t("emptyWelcomeDescription")}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4 pb-8">
        {canCreateMeetings ? (
          <Button
            asChild
            size="lg"
            className="bg-primary w-full max-w-sm font-semibold text-primary-foreground shadow-sm hover:bg-primary/90 sm:w-auto"
          >
            <Link href="/meetings/new">{t("createFirstMeeting")}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
