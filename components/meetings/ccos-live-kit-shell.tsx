"use client";

import "@livekit/components-styles";
import { LiveKitRoom, VideoConference } from "@livekit/components-react";
import { useTranslations } from "next-intl";

type CCOSLiveKitShellProps = {
  serverUrl: string;
  token: string;
  canSpeak: boolean;
  onLeave: () => void;
};

export function CCOSLiveKitShell({
  serverUrl,
  token,
  canSpeak,
  onLeave,
}: CCOSLiveKitShellProps) {
  const t = useTranslations("meetings.live");

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
        <div className="border-b px-3 py-2">
          <p className="text-muted-foreground text-xs">{t("roomHint")}</p>
        </div>
        <div className="relative min-h-0 flex-1">
          <VideoConference />
        </div>
      </LiveKitRoom>
    </div>
  );
}
