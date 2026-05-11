"use client";

import type { LiveRecordingStatus, LiveSessionStatus, MeetingStatus } from "@prisma/client";

import { LiveActiveVoteDialog } from "@/components/meetings/LiveActiveVoteDialog";
import { LiveAiTranscriptDraftCard } from "@/components/meetings/LiveAiTranscriptDraftCard";
import { LiveAuditLogPanel } from "@/components/meetings/LiveAuditLogPanel";
import { LiveGovernancePanel } from "@/components/meetings/LiveGovernancePanel";
import { LiveParticipantRoster } from "@/components/meetings/LiveParticipantRoster";
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
    import("@/components/meetings/ccos-live-kit-shell").then((m) => m.CCOSLiveKitShell),
  { ssr: false, loading: () => <Spinner className="size-8" /> },
);

type LiveSessionRow = {
  id: string;
  status: LiveSessionStatus;
  roomName: string;
  recordingStatus?: LiveRecordingStatus;
  recordingUrl?: string | null;
};

type SessionGetResponse = {
  roomName: string;
  session: LiveSessionRow | null;
  canModerate: boolean;
  governance?: {
    canOpenLiveVote: boolean;
    canRecordLiveDecision: boolean;
    canModerateMedia: boolean;
    canControlRecording?: boolean;
    canApproveLiveDecision?: boolean;
  };
};

type TokenPostResponse = {
  token: string;
  wsUrl: string;
  roomName: string;
  capabilities: {
    canSpeak: boolean;
    canRaiseHand?: boolean;
    canModerateMedia?: boolean;
  };
};

type AgendaLite = { id: string; titleAr: string; titleEn: string | null };

type InviteeLite = { id: string; name: string };

type CCOSLiveTabProps = {
  meetingId: string;
  meetingStatus: MeetingStatus;
  locale: "ar" | "en";
  currentUserId: string;
  currentUserName: string;
  agenda: AgendaLite[];
  invitees: InviteeLite[];
  canManageMeetings: boolean;
  canUseAiTranscriptDraft: boolean;
  isInvitee: boolean;
  onMeetingUpdated: () => void;
};

export function CCOSLiveTab({
  meetingId,
  meetingStatus,
  locale,
  currentUserId,
  currentUserName,
  agenda,
  invitees,
  canManageMeetings,
  canUseAiTranscriptDraft,
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
  const [governance, setGovernance] = useState<SessionGetResponse["governance"] | null>(
    null,
  );
  const [recordingBusy, setRecordingBusy] = useState(false);

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

  const recordingAction = async (action: "start" | "stop") => {
    setRecordingBusy(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/recording`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.status === 503 && body.error === "recording_not_configured") {
        toast.error(t("recordingNotConfigured"));
        return;
      }
      if (!res.ok) {
        toast.error(t("recordingError"));
        return;
      }
      toast.success(action === "start" ? t("recordingStartedToast") : t("recordingStopToast"));
      await loadSession();
    } catch {
      toast.error(t("recordingError"));
    } finally {
      setRecordingBusy(false);
    }
  };

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
          meetingId={meetingId}
          liveSessionId={activeLiveSession?.id ?? null}
          locale={locale}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
          canPostTranscript={canUseAiTranscriptDraft}
          serverUrl={inRoom.wsUrl}
          token={inRoom.token}
          canSpeak={inRoom.capabilities?.canSpeak ?? true}
          canRaiseHand={inRoom.capabilities?.canRaiseHand ?? false}
          onLeave={leaveRoom}
        />
        {meetingStatus === "LIVE" && activeLiveSession ? (
          <LiveParticipantRoster
            meetingId={meetingId}
            locale={locale}
            currentUserId={currentUserId}
            canModerate={
              Boolean(governance?.canModerateMedia) || canManageMeetings
            }
            canRaiseHand={inRoom.capabilities?.canRaiseHand ?? false}
            isInVideoRoom
          />
        ) : null}
        {meetingStatus === "LIVE" ? (
          <LiveAuditLogPanel meetingId={meetingId} locale={locale} />
        ) : null}
        {meetingStatus === "LIVE" && isInvitee ? (
          <LiveActiveVoteDialog
            meetingId={meetingId}
            currentUserId={currentUserId}
            enabled
          />
        ) : null}
        {meetingStatus === "LIVE" && governance ? (
          <LiveGovernancePanel
            meetingId={meetingId}
            meetingIsLive={meetingStatus === "LIVE"}
            currentUserId={currentUserId}
            agenda={agenda}
            invitees={invitees}
            locale={locale}
            canOpenLiveVote={governance.canOpenLiveVote}
            canRecordLiveDecision={governance.canRecordLiveDecision}
            canApproveLiveDecision={governance.canApproveLiveDecision ?? false}
          />
        ) : null}
        {(meetingStatus === "LIVE" ||
          meetingStatus === "ENDED" ||
          meetingStatus === "ARCHIVED") &&
        canUseAiTranscriptDraft ? (
          <LiveAiTranscriptDraftCard
            meetingId={meetingId}
            locale={locale}
            liveSessionId={activeLiveSession?.id ?? null}
            canUse
          />
        ) : null}
      </div>
    );
  }

  const canStartRoomSession =
    canManageMeetings &&
    (meetingStatus === "SCHEDULED" || meetingStatus === "LIVE") &&
    !activeLiveSession;

  const canJoinVideo =
    meetingStatus === "LIVE" && (isInvitee || canManageMeetings);

  const recordingStatusLabel = () => {
    const rs = activeLiveSession?.recordingStatus;
    if (rs === "RECORDING") return t("recordingStatusRecording");
    if (rs === "COMPLETED") return t("recordingStatusCompleted");
    if (rs === "FAILED") return t("recordingStatusFailed");
    return t("recordingStatusIdle");
  };

  return (
    <div className="space-y-6">
      <LiveActiveVoteDialog
        meetingId={meetingId}
        currentUserId={currentUserId}
        enabled={meetingStatus === "LIVE" && isInvitee}
      />
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

          {activeLiveSession && governance?.canControlRecording ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground text-xs">{recordingStatusLabel()}</span>
              {activeLiveSession.recordingStatus === "RECORDING" ? (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  disabled={recordingBusy}
                  onClick={() => void recordingAction("stop")}
                >
                  {recordingBusy ? <Spinner className="size-4" /> : null}
                  {t("recordingStop")}
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={recordingBusy}
                  onClick={() => void recordingAction("start")}
                >
                  {recordingBusy ? <Spinner className="size-4" /> : null}
                  {t("recordingStart")}
                </Button>
              )}
            </div>
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

      {meetingStatus === "LIVE" && activeLiveSession ? (
        <LiveParticipantRoster
          meetingId={meetingId}
          locale={locale}
          currentUserId={currentUserId}
          canModerate={Boolean(governance?.canModerateMedia) || canManageMeetings}
          canRaiseHand={false}
          isInVideoRoom={false}
        />
      ) : null}

      {meetingStatus === "LIVE" ? (
        <LiveAuditLogPanel meetingId={meetingId} locale={locale} />
      ) : null}

      {meetingStatus === "LIVE" && governance ? (
        <LiveGovernancePanel
          meetingId={meetingId}
          meetingIsLive={meetingStatus === "LIVE"}
          currentUserId={currentUserId}
          agenda={agenda}
          invitees={invitees}
          locale={locale}
          canOpenLiveVote={governance.canOpenLiveVote}
          canRecordLiveDecision={governance.canRecordLiveDecision}
          canApproveLiveDecision={governance.canApproveLiveDecision ?? false}
        />
      ) : null}
      {(meetingStatus === "LIVE" ||
        meetingStatus === "ENDED" ||
        meetingStatus === "ARCHIVED") &&
      canUseAiTranscriptDraft ? (
        <LiveAiTranscriptDraftCard
          meetingId={meetingId}
          locale={locale}
          liveSessionId={activeLiveSession?.id ?? null}
          canUse
        />
      ) : null}
    </div>
  );
}
