"use client";

import type { LiveVoteChoice } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";

type VoteLite = {
  id: string;
  title: string;
  question: string;
  isOpen: boolean;
  ballots: { userId: string; choice: LiveVoteChoice }[];
};

export function LiveActiveVoteDialog({
  meetingId,
  currentUserId,
  enabled,
}: {
  meetingId: string;
  currentUserId: string;
  enabled: boolean;
}) {
  const tGov = useTranslations("meetings.liveGovernance");
  const tVote = useTranslations("meetings.liveVoteDialog");
  const tCommon = useTranslations("common");
  const [votes, setVotes] = useState<VoteLite[]>([]);
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [casting, setCasting] = useState(false);

  const poll = useCallback(async () => {
    if (!enabled) return;
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/votes`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { votes: VoteLite[] };
      const next = data.votes ?? [];
      setVotes(next);
      const pending = next.find(
        (v) => v.isOpen && !v.ballots.some((b) => b.userId === currentUserId),
      );
      if (pending) {
        setActiveId(pending.id);
        setOpen(true);
      } else {
        setOpen(false);
        setActiveId(null);
      }
    } catch {
      /* ignore */
    }
  }, [enabled, meetingId, currentUserId]);

  useEffect(() => {
    if (!enabled) return;
    const tid = window.setInterval(() => {
      void poll();
    }, 3000);
    void poll();
    return () => window.clearInterval(tid);
  }, [enabled, poll]);

  const active = votes.find((v) => v.id === activeId);

  const cast = async (choice: LiveVoteChoice) => {
    if (!active) return;
    setCasting(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/votes/${active.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ choice }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "join_live_to_vote") {
          toast.error(tVote("joinLiveToVote"));
        } else {
          toast.error(tCommon("errorOccurred"));
        }
        return;
      }
      toast.success(tGov("voteCastToast"));
      setOpen(false);
      setActiveId(null);
      await poll();
    } catch {
      toast.error(tCommon("errorOccurred"));
    } finally {
      setCasting(false);
    }
  };

  if (!enabled || !active) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{active.title}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap">
            {active.question}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
          {(["YES", "NO", "ABSTAIN"] as const).map((c) => (
            <Button
              key={c}
              type="button"
              disabled={casting}
              variant={c === "ABSTAIN" ? "outline" : "default"}
              onClick={() => void cast(c)}
            >
              {casting ? <Spinner className="size-4" /> : null}
              {c === "YES"
                ? tGov("choiceYes")
                : c === "NO"
                  ? tGov("choiceNo")
                  : tGov("choiceAbstain")}
            </Button>
          ))}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
