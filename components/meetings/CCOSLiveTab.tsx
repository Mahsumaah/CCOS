"use client";

import type { LiveSessionStatus, MeetingStatus } from "@prisma/client";

import { LiveGovernancePanel } from "@/components/meetings/LiveGovernancePanel";
import { Radio } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

const CCOSLiveKitShell = dynamic(
  () =>
    import("@/components/meetings/ccos-live-kit-shell").then(
      (m) => m.CCOSLiveKitShell,
    ),
  { ssr: false, loading: () => <Spinner className="size-8" /> },
);

type LiveSessionRow = {
  id: string;
  status: LiveSessionStatus;
  roomName: string;
};

type SessionGetResponse = {
  roomName: string;
  session: LiveSessionRow | null;
  canModerate: boolean;
  governance?: {
    canOpenLiveVote: boolean;
    canRecordLiveDecision: boolean;
    canModerateMedia: boolean;
  };
};

type TokenPostResponse = {
  token: string;
  wsUrl: string;
  roomName: string;
  capabilities: { canSpeak: boolean };
};

type AgendaLite = { id: string; titleAr: string; titleEn: string | null };

type CCOSLiveTabProps = {
  meetingId: string;
  meetingStatus: MeetingStatus;
  locale: "ar" | "en";
  currentUserId: string;
  agenda: AgendaLite[];
  canManageMeetings: boolean;
  isInvitee: boolean;
  onMeetingUpdated: () => void;
};

export function CCOSLiveTab({
  meetingId,
  meetingStatus,
  locale,
  currentUserId,
  agenda,
  canManageMeetings,
  isInvitee,
  onMeetingUpdated,
}: CCOSLiveTabProps) {
  const t = useTranslations("meetings.live");
  const [sessionLoading, setSessionLoading] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [roomName, setRoomName] = useState<string | null>(null);
  const [liveSession, setLiveSession] = useState<LiveSessionRow | null>(null);
  const [starting, setStarting] = useState(false);
  const [joining, setJoining] = useState(false);
  const [inRoom, setInRoom] = useState<TokenPostResponse | null>(null);
  const [governance, setGovernance] = useState<
    SessionGetResponse["governance"] | null
  >(null);

  const activeLiveSession =
    liveSession?.status === "LIVE" ? liveSession : null;

  const loadSession = useCallback(async () => {
    await Promise.resolve();
    setSessionLoading(true);
    setSessionError(null);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/session`, {
        credentials: "include",
      });
      if (!res.ok) {
        setSessionError(t("sessionLoadError"));
        return;
      }
      const data = (await res.json()) as SessionGetResponse;
      setRoomName(data.roomName);
      setLiveSession(data.session);
      setGovernance(data.governance ?? null);
    } catch {
      setSessionError(t("sessionLoadError"));
    } finally {
      setSessionLoading(false);
    }
  }, [meetingId, t]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void loadSession();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [loadSession, meetingStatus]);

  const startLiveSession = async () => {
    setStarting(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/session`, {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error(t("startSessionError"));
        return;
      }
      toast.success(t("sessionStarted"));
      onMeetingUpdated();
      await loadSession();
    } catch {
      toast.error(t("startSessionError"));
    } finally {
      setStarting(false);
    }
  };

  const joinRoom = async () => {
    setJoining(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/token`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as TokenPostResponse & {
        error?: string;
        missingEnv?: string[];
      };
      if (res.status === 503 && body.error === "live_not_configured") {
        const vars =
          Array.isArray(body.missingEnv) && body.missingEnv.length > 0
            ? body.missingEnv.join(", ")
            : "";
        toast.error(
          vars
            ? t("serverNotConfiguredFull", { vars })
            : t("serverNotConfiguredFullUnknown"),
        );
        return;
      }
      if (res.status === 400 && body.error === "meeting_not_live") {
        toast.error(t("meetingNotLive"));
        return;
      }
      if (!res.ok || !body.token || !body.wsUrl) {
        toast.error(t("tokenError"));
        return;
      }
      setInRoom(body);
    } catch {
      toast.error(t("tokenError"));
    } finally {
      setJoining(false);
    }
  };

  const leaveRoom = () => setInRoom(null);

  if (!canManageMeetings && !isInvitee) {
    return (
      <Alert>
        <AlertTitle>{t("noAccessTitle")}</AlertTitle>
        <AlertDescription>{t("noAccessDescription")}</AlertDescription>
      </Alert>
    );
  }

  if (sessionLoading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Spinner className="size-4" />
        {t("loadingSession")}
      </div>
    );
  }

  if (sessionError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>{t("sessionLoadErrorTitle")}</AlertTitle>
        <AlertDescription>{sessionError}</AlertDescription>
      </Alert>
    );
  }

  if (inRoom?.token && inRoom.wsUrl) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" onClick={leaveRoom}>
            {t("leaveRoom")}
          </Button>
        </div>
        <CCOSLiveKitShell
          serverUrl={inRoom.wsUrl}
          token={inRoom.token}
          canSpeak={inRoom.capabilities?.canSpeak ?? true}
          onLeave={leaveRoom}
        />
      </div>
    );
  }

  const canStartRoomSession =
    canManageMeetings &&
    (meetingStatus === "SCHEDULED" || meetingStatus === "LIVE") &&
    !activeLiveSession;

  const canJoinVideo =
    meetingStatus === "LIVE" && (isInvitee || canManageMeetings);

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Radio className="text-primary size-5" aria-hidden />
            <CardTitle>{t("title")}</CardTitle>
          </div>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {meetingStatus !== "LIVE" && meetingStatus !== "SCHEDULED" ? (
            <Alert>
              <AlertTitle>{t("meetingNotLiveTitle")}</AlertTitle>
              <AlertDescription>{t("meetingNotLiveDescription")}</AlertDescription>
            </Alert>
          ) : null}

          {roomName ? (
            <p className="text-muted-foreground text-xs">
              {t("roomLabel")}:{" "}
              <span className="text-foreground font-mono text-xs">{roomName}</span>
            </p>
          ) : null}

          {activeLiveSession ? (
            <Alert>
              <AlertTitle>{t("activeSessionTitle")}</AlertTitle>
              <AlertDescription>{t("activeSessionDescription")}</AlertDescription>
            </Alert>
          ) : meetingStatus === "LIVE" ? (
            <Alert>
              <AlertTitle>{t("noActiveSessionTitle")}</AlertTitle>
              <AlertDescription>
                {t("noActiveSessionDescription")}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap gap-2">
            {canStartRoomSession ? (
              <Button
                type="button"
                disabled={starting}
                onClick={() => void startLiveSession()}
              >
                {starting ? <Spinner className="size-4" /> : null}
                {meetingStatus === "SCHEDULED"
                  ? t("startMeetingAndSession")
                  : t("startSession")}
              </Button>
            ) : null}

            {canJoinVideo && activeLiveSession ? (
              <Button
                type="button"
                variant="secondary"
                disabled={joining}
                onClick={() => void joinRoom()}
              >
                {joining ? <Spinner className="size-4" /> : null}
                {t("joinRoom")}
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {meetingStatus === "LIVE" && governance ? (
        <LiveGovernancePanel
          meetingId={meetingId}
          meetingIsLive={meetingStatus === "LIVE"}
          currentUserId={currentUserId}
          agenda={agenda}
          locale={locale}
          canOpenLiveVote={governance.canOpenLiveVote}
          canRecordLiveDecision={governance.canRecordLiveDecision}
        />
      ) : null}
    </div>
  );
}
