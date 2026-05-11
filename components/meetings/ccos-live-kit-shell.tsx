"use client";

import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { Captions, Hand } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useLiveSpeechCaptions } from "@/hooks/use-live-speech-captions";

type CCOSLiveKitShellProps = {
  meetingId: string;
  liveSessionId: string | null;
  locale: "ar" | "en";
  currentUserId: string;
  currentUserName: string;
  /** Only users with minutes/meeting manage perms may post transcript segments (server-enforced). */
  canPostTranscript: boolean;
  serverUrl: string;
  token: string;
  canSpeak: boolean;
  canRaiseHand: boolean;
  onLeave: () => void;
};

export function CCOSLiveKitShell({
  meetingId,
  liveSessionId,
  locale,
  currentUserId,
  currentUserName,
  canPostTranscript,
  serverUrl,
  token,
  canSpeak,
  canRaiseHand,
  onLeave,
}: CCOSLiveKitShellProps) {
  const t = useTranslations("meetings.live");
  const tCap = useTranslations("meetings.liveCaptions");
  const [raised, setRaised] = useState(false);
  const [handLoading, setHandLoading] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(false);

  const speech = useLiveSpeechCaptions({
    meetingId,
    liveSessionId,
    locale,
    speakerUserId: currentUserId,
    speakerName: currentUserName,
    captionsActive: captionsOn,
    canPostTranscript,
    onPosted: () => {
      toast.success(tCap("postedToast"));
    },
    onErrorKey: (key) => {
      if (key === "not-allowed" || key === "service-not-allowed") {
        toast.error(tCap("errorPermission"));
      } else if (key === "postFailed") {
        toast.error(tCap("errorPost"));
      } else if (key === "startFailed") {
        toast.error(tCap("errorStart"));
      } else {
        toast.error(tCap("errorGeneric", { code: key }));
      }
    },
  });

  const toggleHand = async () => {
    setHandLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/participants/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ raisedHand: !raised }),
      });
      if (!res.ok) {
        toast.error(t("raiseHandError"));
        return;
      }
      setRaised((r) => !r);
      toast.success(t("raiseHandToast"));
    } catch {
      toast.error(t("raiseHandError"));
    } finally {
      setHandLoading(false);
    }
  };

  const toggleCaptions = (next: boolean) => {
    if (next && !liveSessionId) {
      toast.error(tCap("needLiveSession"));
      return;
    }
    if (next && !canPostTranscript) {
      toast.error(tCap("forbiddenRole"));
      return;
    }
    if (next) {
      setCaptionsOn(true);
      speech.start();
    } else {
      speech.stop();
      setCaptionsOn(false);
    }
  };

  return (
    <div className="bg-card text-card-foreground flex min-h-[min(70vh,720px)] flex-col overflow-hidden rounded-lg border shadow-sm">
      <LiveKitRoom
        serverUrl={serverUrl}
        token={token}
        connect
        audio={canSpeak}
        video={canSpeak}
        onDisconnected={() => onLeave()}
        className="flex min-h-[min(60vh,640px)] flex-1 flex-col"
        data-lk-theme="default"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
          <p className="text-muted-foreground text-xs">{t("roomHint")}</p>
          <div className="flex flex-wrap items-center gap-3">
            {canPostTranscript ? (
              <div className="flex items-center gap-2">
                <Captions className="text-muted-foreground size-4 shrink-0" aria-hidden />
                <Label htmlFor="ccos-live-captions" className="text-xs font-normal">
                  {tCap("toggleLabel")}
                </Label>
                <Switch
                  id="ccos-live-captions"
                  checked={captionsOn}
                  disabled={!liveSessionId || speech.unsupported}
                  onCheckedChange={(v) => toggleCaptions(v)}
                />
                {speech.listening ? (
                  <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                    <Spinner className="size-3" />
                    {tCap("listening")}
                  </span>
                ) : null}
              </div>
            ) : null}
            {canRaiseHand ? (
              <Button
                type="button"
                size="sm"
                variant={raised ? "default" : "outline"}
                disabled={handLoading}
                onClick={() => void toggleHand()}
              >
                {handLoading ? <Spinner className="size-4" /> : <Hand className="size-4" aria-hidden />}
                {raised ? t("lowerHand") : t("raiseHand")}
              </Button>
            ) : null}
          </div>
        </div>
        {canPostTranscript && speech.unsupported ? (
          <Alert variant="destructive" className="rounded-none border-x-0 border-t-0">
            <AlertTitle>{tCap("unsupportedTitle")}</AlertTitle>
            <AlertDescription>{tCap("unsupportedBody")}</AlertDescription>
          </Alert>
        ) : null}
        {canPostTranscript ? (
          <p className="text-muted-foreground border-b px-3 py-1.5 text-xs">{tCap("scopeHint")}</p>
        ) : null}
        <div className="relative min-h-0 flex-1">
          <VideoConference />
        </div>
      </LiveKitRoom>
    </div>
  );
}
