"use client";

import type { BoardRole } from "@prisma/client";
import { Hand, MoreVertical, RefreshCw, UserMinus, VideoOff, MicOff } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getRoleLabel } from "@/lib/board-roles";
import { formatDateTime } from "@/lib/format";

type RosterRow = {
  id: string;
  userId: string;
  joinedAt: string;
  raisedHandAt: string | null;
  user: { id: string; name: string; role: BoardRole; email: string };
};

type LiveParticipantRosterProps = {
  meetingId: string;
  locale: "ar" | "en";
  currentUserId: string;
  canModerate: boolean;
  canRaiseHand: boolean;
  isInVideoRoom: boolean;
};

export function LiveParticipantRoster({
  meetingId,
  locale,
  currentUserId,
  canModerate,
  canRaiseHand,
  isInVideoRoom,
}: LiveParticipantRosterProps) {
  const t = useTranslations("meetings.liveRoster");
  const tCommon = useTranslations("common");
  const [participants, setParticipants] = useState<RosterRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<RosterRow | null>(null);
  const [removing, setRemoving] = useState(false);

  const load = useCallback(async (reconcile: boolean) => {
    setLoading(true);
    try {
      const q = reconcile ? "?reconcile=1" : "";
      const res = await fetch(`/api/meetings/${meetingId}/live/participants${q}`, {
        credentials: "include",
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      const data = (await res.json()) as { participants: RosterRow[] };
      setParticipants(data.participants ?? []);
      if (reconcile) {
        toast.success(t("reconcileDone"));
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId, t, tCommon]);

  useEffect(() => {
    const tid = window.setInterval(() => {
      void load(false);
    }, 5000);
    void load(false);
    return () => window.clearInterval(tid);
  }, [load]);

  const moderate = async (
    targetUserId: string,
    action: "mute_microphone" | "mute_camera" | "remove",
  ) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/moderation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ targetUserId, action }),
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("moderationSuccess"));
      await load(false);
    } catch {
      toast.error(tCommon("errorOccurred"));
    }
  };

  const confirmRemove = async () => {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      await moderate(removeTarget.userId, "remove");
    } finally {
      setRemoving(false);
      setRemoveTarget(null);
    }
  };

  const sorted = [...participants].sort((a, b) => {
    if (a.raisedHandAt && !b.raisedHandAt) return -1;
    if (!a.raisedHandAt && b.raisedHandAt) return 1;
    return a.user.name.localeCompare(b.user.name);
  });

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => void load(false)}
          >
            {loading ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
            {t("refresh")}
          </Button>
          {canModerate ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={loading}
              onClick={() => void load(true)}
            >
              {t("reconcile")}
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {loading && participants.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner className="size-4" />
            {tCommon("loading")}
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="w-full overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnName")}</TableHead>
                  <TableHead>{t("columnRole")}</TableHead>
                  <TableHead>{t("columnJoined")}</TableHead>
                  <TableHead>{t("columnHand")}</TableHead>
                  {canModerate ? (
                    <TableHead className="w-[1%]">{t("columnActions")}</TableHead>
                  ) : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.user.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getRoleLabel(p.user.role, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {formatDateTime(p.joinedAt, locale)}
                    </TableCell>
                    <TableCell>
                      {p.raisedHandAt ? (
                        <span className="text-primary inline-flex items-center gap-1 text-xs">
                          <Hand className="size-3" aria-hidden />
                          {formatDateTime(p.raisedHandAt, locale)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {canModerate && p.userId !== currentUserId ? (
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button type="button" size="icon" variant="ghost" aria-label={t("moderateMenu")}>
                              <MoreVertical className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => void moderate(p.userId, "mute_microphone")}
                            >
                              <MicOff className="size-4" />
                              {t("muteMic")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => void moderate(p.userId, "mute_camera")}
                            >
                              <VideoOff className="size-4" />
                              {t("muteCamera")}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => setRemoveTarget(p)}
                            >
                              <UserMinus className="size-4" />
                              {t("remove")}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    ) : canModerate ? (
                      <TableCell>—</TableCell>
                    ) : null}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {canRaiseHand && isInVideoRoom ? (
          <p className="text-muted-foreground mt-3 text-xs">{t("raiseHandHint")}</p>
        ) : null}
      </CardContent>

      <AlertDialog open={removeTarget != null} onOpenChange={() => setRemoveTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("removeConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("removeConfirmDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={removing} onClick={() => void confirmRemove()}>
              {t("remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
