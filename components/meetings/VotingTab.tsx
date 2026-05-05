"use client";

import type { VoteChoice } from "@prisma/client";
import {
  Check,
  Lock,
  Minus,
  ThumbsDown,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDateTime, formatRelativeTime } from "@/lib/format";
import type { QuorumDTO } from "@/lib/meeting-quorum";
import { usePermissions } from "@/lib/permissions-context";
import {
  computeVoteOutcome,
  type VoteOutcome,
} from "@/lib/vote-outcome";
import { cn } from "@/lib/utils";

export type LiveVoteDTO = {
  id: string;
  question: string;
  isOpen: boolean;
  agendaItemId: string | null;
  agendaItem: {
    id: string;
    titleAr: string;
    titleEn: string | null;
  } | null;
  openedAt: string;
  closedAt: string | null;
  createdBy: { id: string; name: string };
  tallies: { approve: number; reject: number; abstain: number; total: number };
  myBallot: VoteChoice | null;
  ballots: {
    userId: string;
    userName: string;
    choice: VoteChoice;
    castById: string | null;
    castByName: string | null;
  }[];
};

type LiveResponse = {
  votes: LiveVoteDTO[];
  totalInvited: number;
  proxyVoteFor?: { userId: string; name: string }[];
};

type AgendaOption = { id: string; titleAr: string; titleEn: string | null };

function pct(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 1000) / 10;
}

function tallyHighlightClass(choice: VoteChoice) {
  switch (choice) {
    case "APPROVE":
      return "border-emerald-600/50 bg-emerald-50/50 dark:border-emerald-500/40 dark:bg-emerald-950/30";
    case "REJECT":
      return "border-red-500/50 bg-red-50/50 dark:border-red-500/40 dark:bg-red-950/30";
    default:
      return "border-amber-500/50 bg-amber-50/50 dark:border-amber-500/40 dark:bg-amber-950/30";
  }
}

function TallyBar({
  label,
  count,
  total,
  barClass,
  isWinner,
  winnerChoice,
}: {
  label: string;
  count: number;
  total: number;
  barClass: string;
  isWinner?: boolean;
  winnerChoice?: VoteChoice;
}) {
  const p = pct(count, total);
  return (
    <div
      className={cn(
        "space-y-1 rounded-md border border-transparent p-2 transition-colors",
        isWinner &&
          winnerChoice &&
          tallyHighlightClass(winnerChoice),
      )}
    >
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
          {isWinner ? (
            <Check
              className={cn(
                "size-4 shrink-0",
                winnerChoice === "APPROVE" &&
                  "text-emerald-600 dark:text-emerald-400",
                winnerChoice === "REJECT" && "text-red-600 dark:text-red-400",
                winnerChoice === "ABSTAIN" &&
                  "text-amber-600 dark:text-amber-400",
              )}
              aria-hidden
            />
          ) : null}
          {label}
        </span>
        <span className="tabular-nums">
          {count} ({p}%)
        </span>
      </div>
      <div className="bg-muted h-2 w-full overflow-hidden rounded-full">
        <div
          className={cn("h-full transition-all", barClass)}
          style={{ width: `${p}%` }}
        />
      </div>
    </div>
  );
}

function voteResultHeadline(
  outcome: VoteOutcome,
  tVotes: (key: string, values?: Record<string, string | number>) => string,
): string {
  switch (outcome.kind) {
    case "NONE":
      return tVotes("resultNoBallots");
    case "TIE":
      return tVotes("resultTie");
    case "WIN":
      if (outcome.choice === "APPROVE") return tVotes("resultApproved");
      if (outcome.choice === "REJECT") return tVotes("resultRejected");
      return tVotes("resultAbstainWins");
    default:
      return "";
  }
}

function voteClosedPanelClass(outcome: VoteOutcome): string {
  switch (outcome.kind) {
    case "WIN":
      return tallyHighlightClass(outcome.choice);
    case "TIE":
      return "border-amber-600/40 bg-amber-50/40 dark:border-amber-500/30 dark:bg-amber-950/25";
    default:
      return "border-muted-foreground/25 bg-muted/30";
  }
}

function buildDecisionDraftFromVote(
  vote: LiveVoteDTO,
  outcome: VoteOutcome,
  tVotes: (key: string, values?: Record<string, string | number>) => string,
): { textAr: string; agendaItemId: string | null } {
  const headline = voteResultHeadline(outcome, tVotes);
  const summary = tVotes("tallySummary", {
    approve: vote.tallies.approve,
    reject: vote.tallies.reject,
    abstain: vote.tallies.abstain,
  });
  return {
    textAr: `${vote.question}\n\n${headline}\n${summary}`,
    agendaItemId: vote.agendaItemId,
  };
}

export function VotingTab({
  meetingId,
  currentUserId,
  isLive,
  locale,
  agenda,
  quorum,
  onConvertToDecision,
}: {
  meetingId: string;
  currentUserId: string;
  isLive: boolean;
  locale: "ar" | "en";
  agenda: AgendaOption[];
  quorum: QuorumDTO | null;
  onConvertToDecision?: (draft: {
    textAr: string;
    agendaItemId: string | null;
  }) => void;
}) {
  const perms = usePermissions();
  const tVotes = useTranslations("votes");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [votes, setVotes] = useState<LiveVoteDTO[]>([]);
  const [totalInvited, setTotalInvited] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [newQuestion, setNewQuestion] = useState("");
  const [newAgendaId, setNewAgendaId] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [actingVoteId, setActingVoteId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LiveVoteDTO | null>(null);
  const [proxyVoteFor, setProxyVoteFor] = useState<
    { userId: string; name: string }[]
  >([]);

  const fetchLive = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as LiveResponse;
      setVotes(data.votes ?? []);
      setTotalInvited(data.totalInvited ?? 0);
      setProxyVoteFor(data.proxyVoteFor ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void fetchLive();
  }, [fetchLive]);

  useEffect(() => {
    if (!isLive) return;
    const id = window.setInterval(() => void fetchLive(), 10_000);
    return () => window.clearInterval(id);
  }, [isLive, fetchLive]);

  const agendaLabel = useMemo(
    () => (item: AgendaOption) =>
      locale === "en" && item.titleEn?.trim()
        ? item.titleEn
        : item.titleAr,
    [locale],
  );

  const choiceLabel = (c: VoteChoice) => {
    if (c === "APPROVE") return tVotes("approve");
    if (c === "REJECT") return tVotes("reject");
    return tVotes("abstain");
  };

  const openCreate = () => {
    setNewQuestion("");
    setNewAgendaId("");
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    const q = newQuestion.trim();
    if (!q) {
      toast.error(tVotes("questionRequired"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          question: q,
          agendaItemId: newAgendaId || undefined,
        }),
      });
      if (!res.ok) {
        toast.error(tVotes("createError"));
        return;
      }
      toast.success(tVotes("voteCreated"));
      setCreateOpen(false);
      await fetchLive();
    } finally {
      setCreating(false);
    }
  };

  const castBallot = async (
    voteId: string,
    choice: VoteChoice,
    voteAsUserId?: string,
  ) => {
    setActingVoteId(voteId);
    try {
      const res = await fetch(`/api/votes/${voteId}/ballot`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          choice,
          ...(voteAsUserId ? { userId: voteAsUserId } : {}),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? tVotes("ballotError"));
        return;
      }
      await fetchLive();
    } finally {
      setActingVoteId(null);
    }
  };

  const closeVote = async (voteId: string, forceClose = false) => {
    setActingVoteId(voteId);
    try {
      const res = await fetch(`/api/votes/${voteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isOpen: false,
          ...(forceClose ? { forceClose: true } : {}),
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (body.error === "QUORUM_NOT_MET") {
          toast.error(tVotes("quorumCloseBlocked"));
          return;
        }
        toast.error(tVotes("closeError"));
        return;
      }
      toast.success(tVotes("voteClosed"));
      await fetchLive();
    } finally {
      setActingVoteId(null);
    }
  };

  const deleteVote = async () => {
    if (!deleteTarget) return;
    const voteId = deleteTarget.id;
    setActingVoteId(voteId);
    try {
      const res = await fetch(`/api/votes/${voteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error(tVotes("deleteError"));
        return;
      }
      toast.success(tVotes("voteDeleted"));
      setDeleteTarget(null);
      await fetchLive();
    } finally {
      setActingVoteId(null);
    }
  };

  if (loading) {
    return (
      <section className="space-y-4">
        {perms.canCreateVotes && isLive ? (
          <div className="flex justify-end">
            <Skeleton className="h-9 w-36" />
          </div>
        ) : null}
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-3 pb-2">
                <Skeleton className="h-5 w-[85%]" />
                <Skeleton className="h-3 w-48" />
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-16 rounded-full" />
                  <Skeleton className="size-8 rounded-md" />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-full" />
                <Skeleton className="h-2 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {perms.canCreateVotes && isLive ? (
        <div className="flex justify-end">
          <Button type="button" onClick={openCreate}>
            {tVotes("createVote")}
          </Button>
        </div>
      ) : null}

      {votes.length === 0 ? (
        <p className="text-muted-foreground text-sm">{tVotes("emptyVotes")}</p>
      ) : (
        <ul className="space-y-4">
          {votes.map((vote) => {
            const { tallies } = vote;
            const outcome = computeVoteOutcome(tallies);
            const winChoice = outcome.kind === "WIN" ? outcome.choice : null;
            const total = tallies.total;
            const votedCount = vote.ballots.length;
            const canManage = perms.canManageMeetings;
            const agendaTitle =
              vote.agendaItem &&
              (locale === "en" && vote.agendaItem.titleEn?.trim()
                ? vote.agendaItem.titleEn
                : vote.agendaItem.titleAr);

            return (
              <li key={vote.id}>
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
                    <div className="min-w-0 flex-1 space-y-1">
                      <CardTitle className="text-base leading-snug">
                        {vote.question}
                      </CardTitle>
                      {agendaTitle ? (
                        <p className="text-muted-foreground text-sm">
                          {agendaTitle}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground text-xs">
                        {vote.createdBy.name} ·{" "}
                        {formatDateTime(vote.openedAt, locale)} (
                        {formatRelativeTime(vote.openedAt, locale)})
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge
                        variant={vote.isOpen ? "default" : "secondary"}
                        className={
                          vote.isOpen
                            ? "bg-emerald-600 hover:bg-emerald-600/90"
                            : ""
                        }
                      >
                        {vote.isOpen ? tVotes("open") : tVotes("closed")}
                      </Badge>
                      {canManage && vote.isOpen ? (
                        <div className="flex flex-wrap items-center gap-1">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-8"
                            disabled={actingVoteId === vote.id}
                            aria-label={tVotes("closeVote")}
                            onClick={() => void closeVote(vote.id, false)}
                          >
                            <Lock className="size-4" />
                          </Button>
                          {perms.canManageMeetings &&
                          quorum?.required &&
                          !quorum.met ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-muted-foreground h-8 px-2 text-xs"
                              disabled={actingVoteId === vote.id}
                              onClick={() => void closeVote(vote.id, true)}
                            >
                              {tVotes("forceCloseVote")}
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                      {canManage ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="text-destructive size-8"
                          disabled={actingVoteId === vote.id}
                          aria-label={tCommon("delete")}
                          onClick={() => setDeleteTarget(vote)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-muted-foreground text-xs">
                      {tVotes("tallyVotesCast", {
                        x: votedCount,
                        y: totalInvited,
                      })}
                    </p>

                    {!vote.isOpen ? (
                      <div
                        className={cn(
                          "rounded-lg border-2 p-3",
                          voteClosedPanelClass(outcome),
                        )}
                      >
                        <p className="text-base font-semibold leading-snug">
                          {voteResultHeadline(outcome, tVotes)}
                        </p>
                        {perms.canCreateDecisions && onConvertToDecision ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="mt-3"
                            onClick={() =>
                              onConvertToDecision(
                                buildDecisionDraftFromVote(
                                  vote,
                                  outcome,
                                  tVotes,
                                ),
                              )
                            }
                          >
                            {tVotes("convertToDecision")}
                          </Button>
                        ) : null}
                      </div>
                    ) : null}

                    <div className="space-y-3">
                      <TallyBar
                        label={tVotes("approve")}
                        count={tallies.approve}
                        total={total || 1}
                        barClass="bg-emerald-600"
                        isWinner={Boolean(
                          !vote.isOpen && winChoice === "APPROVE",
                        )}
                        winnerChoice={winChoice ?? undefined}
                      />
                      <TallyBar
                        label={tVotes("reject")}
                        count={tallies.reject}
                        total={total || 1}
                        barClass="bg-red-600"
                        isWinner={Boolean(
                          !vote.isOpen && winChoice === "REJECT",
                        )}
                        winnerChoice={winChoice ?? undefined}
                      />
                      <TallyBar
                        label={tVotes("abstain")}
                        count={tallies.abstain}
                        total={total || 1}
                        barClass="bg-amber-500"
                        isWinner={Boolean(
                          !vote.isOpen && winChoice === "ABSTAIN",
                        )}
                        winnerChoice={winChoice ?? undefined}
                      />
                    </div>

                    {vote.myBallot != null ||
                    (vote.isOpen && perms.canCastVotes) ? (
                      <div className="flex flex-wrap gap-2 pt-1">
                        {(["APPROVE", "REJECT", "ABSTAIN"] as const).map(
                          (choice) => {
                            const selected = vote.myBallot === choice;
                            const locked =
                              vote.myBallot != null ||
                              !vote.isOpen ||
                              actingVoteId === vote.id;
                            const border =
                              choice === "APPROVE"
                                ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                : choice === "REJECT"
                                  ? "border-red-600 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                  : "border-amber-500 text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30";
                            const Icon =
                              choice === "APPROVE"
                                ? ThumbsUp
                                : choice === "REJECT"
                                  ? ThumbsDown
                                  : Minus;
                            return (
                              <Button
                                key={choice}
                                type="button"
                                variant="outline"
                                className={cn(
                                  "gap-2",
                                  border,
                                  selected &&
                                    "ring-2 ring-offset-2 ring-offset-background",
                                  choice === "APPROVE" &&
                                    selected &&
                                    "ring-emerald-600",
                                  choice === "REJECT" &&
                                    selected &&
                                    "ring-red-600",
                                  choice === "ABSTAIN" &&
                                    selected &&
                                    "ring-amber-500",
                                )}
                                disabled={locked}
                                onClick={() =>
                                  vote.isOpen && !vote.myBallot
                                    ? void castBallot(vote.id, choice, undefined)
                                    : undefined
                                }
                              >
                                <Icon className="size-4" />
                                {choice === "APPROVE"
                                  ? tVotes("approve")
                                  : choice === "REJECT"
                                    ? tVotes("reject")
                                    : tVotes("abstain")}
                              </Button>
                            );
                          },
                        )}
                      </div>
                    ) : null}

                    {vote.myBallot ? (
                      <p className="text-muted-foreground text-sm">
                        {tVotes("youVoted", {
                          choice: choiceLabel(vote.myBallot),
                        })}
                      </p>
                    ) : null}

                    {vote.isOpen && perms.canCastVotes && proxyVoteFor.length > 0
                      ? proxyVoteFor.map((delegator) => {
                          const proxyBallot = vote.ballots.find(
                            (b) => b.userId === delegator.userId,
                          );
                          const proxyChoice = proxyBallot?.choice ?? null;
                          return (
                            <div
                              key={`${vote.id}-proxy-${delegator.userId}`}
                              className="border-t pt-3 space-y-2"
                            >
                              <p className="text-sm font-medium">
                                {tVotes("proxyVoteFor", { name: delegator.name })}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {(
                                  ["APPROVE", "REJECT", "ABSTAIN"] as const
                                ).map((choice) => {
                                  const selected = proxyChoice === choice;
                                  const locked =
                                    proxyChoice != null ||
                                    !vote.isOpen ||
                                    actingVoteId === vote.id;
                                  const border =
                                    choice === "APPROVE"
                                      ? "border-emerald-600 text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                      : choice === "REJECT"
                                        ? "border-red-600 text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                                        : "border-amber-500 text-amber-800 hover:bg-amber-50 dark:hover:bg-amber-950/30";
                                  const Icon =
                                    choice === "APPROVE"
                                      ? ThumbsUp
                                      : choice === "REJECT"
                                        ? ThumbsDown
                                        : Minus;
                                  return (
                                    <Button
                                      key={`${delegator.userId}-${choice}`}
                                      type="button"
                                      variant="outline"
                                      className={cn(
                                        "gap-2",
                                        border,
                                        selected &&
                                          "ring-2 ring-offset-2 ring-offset-background",
                                        choice === "APPROVE" &&
                                          selected &&
                                          "ring-emerald-600",
                                        choice === "REJECT" &&
                                          selected &&
                                          "ring-red-600",
                                        choice === "ABSTAIN" &&
                                          selected &&
                                          "ring-amber-500",
                                      )}
                                      disabled={locked}
                                      onClick={() =>
                                        vote.isOpen && !proxyChoice
                                          ? void castBallot(
                                              vote.id,
                                              choice,
                                              delegator.userId,
                                            )
                                          : undefined
                                      }
                                    >
                                      <Icon className="size-4" />
                                      {choice === "APPROVE"
                                        ? tVotes("approve")
                                        : choice === "REJECT"
                                          ? tVotes("reject")
                                          : tVotes("abstain")}
                                    </Button>
                                  );
                                })}
                              </div>
                              {proxyChoice ? (
                                <p className="text-muted-foreground text-xs">
                                  {tVotes("proxyYouVoted", {
                                    name: delegator.name,
                                    choice: choiceLabel(proxyChoice),
                                  })}
                                </p>
                              ) : null}
                            </div>
                          );
                        })
                      : null}

                    {!vote.isOpen && !vote.myBallot && perms.canCastVotes ? (
                      <p className="text-muted-foreground text-sm">
                        {tVotes("cannotVoteClosed")}
                      </p>
                    ) : null}

                    {vote.ballots.length > 0 ? (
                      <ul className="border-t pt-3 text-xs text-muted-foreground space-y-1">
                        {vote.ballots.map((b) => (
                          <li key={`${vote.id}-${b.userId}`}>
                            <span className="text-foreground">{b.userName}</span>
                            {" — "}
                            {choiceLabel(b.choice)}
                            {b.castById ? (
                              <span>
                                {" "}
                                <span className="text-amber-700 dark:text-amber-400">
                                  ({tVotes("proxyShort")})
                                </span>
                                {b.castByName ? (
                                  <span>
                                    {" "}
                                    ({tVotes("viaProxy", { name: b.castByName })})
                                  </span>
                                ) : null}
                              </span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tVotes("createVote")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="vote-question">{tVotes("question")}</Label>
              <Textarea
                id="vote-question"
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                rows={4}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{tVotes("linkAgenda")}</Label>
              <Select
                value={newAgendaId || "__none__"}
                onValueChange={(v) =>
                  setNewAgendaId(v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={tVotes("linkAgendaOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {tVotes("linkAgendaNone")}
                  </SelectItem>
                  {agenda.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {agendaLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={creating}
              onClick={() => void submitCreate()}
            >
              {creating ? <Spinner className="size-4" /> : tVotes("submitVote")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{tVotes("deleteVoteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {tVotes("deleteVoteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void deleteVote()}
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
