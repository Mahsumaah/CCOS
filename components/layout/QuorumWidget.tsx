"use client";

import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";
import { Link } from "@/lib/i18n/routing";
import type { QuorumDTO } from "@/lib/meeting-quorum";
import { cn } from "@/lib/utils";

function QuorumRing({
  met,
  required,
  progress,
}: {
  met: boolean;
  required: boolean;
  progress: number;
}) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const p = required ? Math.min(1, Math.max(0, progress)) : 1;
  const offset = c * (1 - p);

  return (
    <svg viewBox="0 0 64 64" className="size-14 shrink-0" aria-hidden>
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        className="stroke-muted"
        strokeWidth="6"
      />
      <circle
        cx="32"
        cy="32"
        r={r}
        fill="none"
        className={cn(
          "origin-center -rotate-90 transition-[stroke-dashoffset] duration-500",
          met ? "stroke-emerald-600 dark:stroke-emerald-400" : "stroke-amber-500 dark:stroke-amber-400",
        )}
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

export function QuorumWidget({
  locale,
  liveQuorum,
}: {
  locale: "ar" | "en";
  liveQuorum: {
    meetingId: string;
    title: string;
    quorum: QuorumDTO;
  } | null;
}) {
  const t = useTranslations("quorum");

  if (!liveQuorum) return null;

  const { quorum, meetingId, title } = liveQuorum;
  const progress =
    quorum.required && quorum.threshold > 0
      ? quorum.current / quorum.threshold
      : 1;

  const pulse =
    quorum.required && !quorum.met ? "animate-pulse motion-reduce:animate-none" : "";

  return (
    <SidebarGroup className="px-2">
      <SidebarGroupLabel className="text-sidebar-foreground/80">
        {t("title")}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <Link
          href={`/meetings/${meetingId}`}
          locale={locale}
          className={cn(
            "block rounded-lg border border-sidebar-border bg-sidebar-accent/30 p-3 outline-none transition-colors",
            "hover:bg-sidebar-accent/55 focus-visible:ring-2 focus-visible:ring-sidebar-ring",
            pulse,
          )}
        >
          <div className="flex items-center gap-3">
            <QuorumRing
              met={quorum.met}
              required={quorum.required}
              progress={progress}
            />
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-xl font-semibold tabular-nums leading-none">
                {quorum.required
                  ? `${quorum.current} / ${quorum.threshold}`
                  : "—"}
              </p>
              <Badge
                variant="secondary"
                className={cn(
                  !quorum.required
                    ? "bg-muted-foreground/20 text-foreground"
                    : quorum.met
                      ? "bg-emerald-600 text-white hover:bg-emerald-600/90"
                      : "bg-amber-600 text-white hover:bg-amber-600/90",
                )}
              >
                {!quorum.required
                  ? t("notRequired")
                  : quorum.met
                    ? t("met")
                    : t("notMet")}
              </Badge>
            </div>
          </div>
          <p className="text-sidebar-foreground/90 mt-2 line-clamp-2 text-xs font-medium">
            {title}
          </p>
        </Link>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}
