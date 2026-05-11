"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { LiveDecisionStatus, LiveVoteChoice } from "@prisma/client";
import { LiveVoteRule, LiveVoteVisibility } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { I18nFormMessage } from "@/components/forms/i18n-form-message";
import { formatDateTime } from "@/lib/format";

type AgendaOption = { id: string; titleAr: string; titleEn: string | null };

type InviteeOption = { id: string; name: string };

type VoteResultJson = {
  yes?: number;
  no?: number;
  abstain?: number;
  weightedYes?: number;
  weightedNo?: number;
  weightedAbstain?: number;
  outcome?: string;
  explanationKey?: string;
};

type LiveVoteRow = {
  id: string;
  title: string;
  question: string;
  isOpen: boolean;
  visibility: LiveVoteVisibility;
  rule: LiveVoteRule;
  quorumRequired: boolean;
  ballots: { userId: string; choice: LiveVoteChoice }[];
  resultJson: unknown;
};

type LiveDecisionRow = {
  id: string;
  decisionText: string;
  eventAt: string;
  status: LiveDecisionStatus;
  approved: boolean;
  requiresVote: boolean;
  notes: string | null;
  dueDate: string | null;
  agendaItem: { id: string; titleAr: string; titleEn: string | null } | null;
  recordedBy: { id: string; name: string };
  proposedBy: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
};

const openVoteSchema = z.object({
  title: z.string().min(3).max(200),
  question: z.string().min(3).max(2000),
  visibility: z.nativeEnum(LiveVoteVisibility),
  rule: z.nativeEnum(LiveVoteRule),
  quorumRequired: z.boolean(),
});

const recordDecisionSchema = z.object({
  decisionText: z.string().min(5).max(5000),
  agendaItemId: z.string(),
  proposedById: z.string(),
  ownerId: z.string(),
  dueDate: z.string().optional(),
  notes: z.string().max(3000).optional(),
  requiresVote: z.boolean(),
});

type OpenVoteValues = z.infer<typeof openVoteSchema>;
type RecordDecisionValues = z.infer<typeof recordDecisionSchema>;

type LiveGovernancePanelProps = {
  meetingId: string;
  meetingIsLive: boolean;
  currentUserId: string;
  agenda: AgendaOption[];
  invitees: InviteeOption[];
  locale: "ar" | "en";
  canOpenLiveVote: boolean;
  canRecordLiveDecision: boolean;
  canApproveLiveDecision: boolean;
};

function parseVoteResult(raw: unknown): VoteResultJson | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as VoteResultJson;
  if (typeof o.yes !== "number") return null;
  return o;
}

export function LiveGovernancePanel({
  meetingId,
  meetingIsLive,
  currentUserId,
  agenda,
  invitees,
  locale,
  canOpenLiveVote,
  canRecordLiveDecision,
  canApproveLiveDecision,
}: LiveGovernancePanelProps) {
  const t = useTranslations("meetings.liveGovernance");
  const tCommon = useTranslations("common");
  const [votes, setVotes] = useState<LiveVoteRow[]>([]);
  const [decisions, setDecisions] = useState<LiveDecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [castingId, setCastingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [editDecision, setEditDecision] = useState<LiveDecisionRow | null>(null);
  const [editText, setEditText] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingDecision, setSavingDecision] = useState(false);

  const agendaTitle = (a: AgendaOption) =>
    locale === "en" && a.titleEn ? a.titleEn : a.titleAr;

  const loadData = useCallback(async () => {
    if (!meetingIsLive) return;
    await Promise.resolve();
    setLoading(true);
    try {
      const [vRes, dRes] = await Promise.all([
        fetch(`/api/meetings/${meetingId}/live/votes`, { credentials: "include" }),
        fetch(`/api/meetings/${meetingId}/live/decisions`, {
          credentials: "include",
        }),
      ]);
      if (vRes.ok) {
        const vJson = (await vRes.json()) as { votes: LiveVoteRow[] };
        setVotes(vJson.votes ?? []);
      }
      if (dRes.ok) {
        const dJson = (await dRes.json()) as { decisions: LiveDecisionRow[] };
        setDecisions(dJson.decisions ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId, meetingIsLive]);

  useEffect(() => {
    const tid = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(tid);
  }, [loadData]);

  const openVoteForm = useForm<OpenVoteValues>({
    resolver: zodResolver(openVoteSchema),
    defaultValues: {
      title: "",
      question: "",
      visibility: "PUBLIC",
      rule: "MAJORITY",
      quorumRequired: false,
    },
  });

  const decisionForm = useForm<RecordDecisionValues>({
    resolver: zodResolver(recordDecisionSchema),
    defaultValues: {
      decisionText: "",
      agendaItemId: "_none",
      proposedById: "_none",
      ownerId: "_none",
      dueDate: "",
      notes: "",
      requiresVote: false,
    },
  });

  const onOpenVote = openVoteForm.handleSubmit(async (values) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "quorum_not_met") {
          toast.error(t("quorumBlockedToast"));
          return;
        }
      }
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("voteOpenedToast"));
      setVoteOpen(false);
      openVoteForm.reset({
        title: "",
        question: "",
        visibility: "PUBLIC",
        rule: "MAJORITY",
        quorumRequired: false,
      });
      await loadData();
    } catch {
      toast.error(tCommon("errorOccurred"));
    }
  });

  const onRecordDecision = decisionForm.handleSubmit(async (values) => {
    try {
      const agendaItemId =
        values.agendaItemId === "_none" ? null : values.agendaItemId;
      const proposedById =
        values.proposedById === "_none" ? null : values.proposedById;
      const ownerId = values.ownerId === "_none" ? null : values.ownerId;
      const dueDate =
        values.dueDate && values.dueDate.length > 0
          ? new Date(values.dueDate).toISOString()
          : null;
      const res = await fetch(`/api/meetings/${meetingId}/live/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          decisionText: values.decisionText,
          agendaItemId,
          proposedById,
          ownerId,
          dueDate,
          notes: values.notes?.trim() ? values.notes : null,
          requiresVote: values.requiresVote,
        }),
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("decisionRecordedToast"));
      decisionForm.reset({
        decisionText: "",
        agendaItemId: "_none",
        proposedById: "_none",
        ownerId: "_none",
        dueDate: "",
        notes: "",
        requiresVote: false,
      });
      await loadData();
    } catch {
      toast.error(tCommon("errorOccurred"));
    }
  });

  const cast = async (voteId: string, choice: LiveVoteChoice) => {
    setCastingId(voteId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/votes/${voteId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ choice }),
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("voteCastToast"));
      await loadData();
    } catch {
      toast.error(tCommon("errorOccurred"));
    } finally {
      setCastingId(null);
    }
  };

  const closeVote = async (voteId: string) => {
    setClosingId(voteId);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/votes/${voteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "close" }),
      });
      if (res.status === 400) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (
          body.error === "quorum_not_met_close" ||
          body.error === "quorum_not_met"
        ) {
          toast.error(t("quorumBlockedToast"));
          return;
        }
      }
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("voteClosedToast"));
      await loadData();
    } catch {
      toast.error(tCommon("errorOccurred"));
    } finally {
      setClosingId(null);
    }
  };

  const patchDecision = async (
    decisionId: string,
    body: Record<string, unknown>,
  ) => {
    setSavingDecision(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/decisions/${decisionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(
        body.action === "approve"
          ? t("decisionApprovedToast")
          : body.action === "reject"
            ? t("decisionRejectedToast")
            : t("decisionUpdatedToast"),
      );
      setEditDecision(null);
      await loadData();
    } catch {
      toast.error(tCommon("errorOccurred"));
    } finally {
      setSavingDecision(false);
    }
  };

  const saveEditDecision = async () => {
    if (!editDecision) return;
    await patchDecision(editDecision.id, {
      decisionText: editText,
      notes: editNotes.trim() ? editNotes : null,
    });
  };

  if (!meetingIsLive) {
    return null;
  }

  const myChoice = (vote: LiveVoteRow) =>
    vote.ballots.find((b) => b.userId === currentUserId)?.choice ?? null;

  const statusBadge = (s: LiveDecisionStatus, approved: boolean) => {
    if (s === "APPROVED" || approved) {
      return <Badge variant="default">{t("statusApproved")}</Badge>;
    }
    if (s === "REJECTED") {
      return <Badge variant="destructive">{t("statusRejected")}</Badge>;
    }
    if (s === "IN_REVIEW") {
      return <Badge variant="secondary">{t("statusReview")}</Badge>;
    }
    return <Badge variant="outline">{t("statusDraft")}</Badge>;
  };

  const outcomeLabel = (key?: string) => {
    switch (key) {
      case "majorityPassed":
      case "weightedPassed":
        return t("resultPassed");
      case "majorityFailed":
      case "weightedFailed":
        return t("resultFailed");
      case "tie":
        return t("resultTie");
      case "noQuorum":
        return t("resultNoQuorum");
      default:
        return "";
    }
  };

  return (
    <div className="space-y-6">
      <Card className="shadow-sm">
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t("votesTitle")}</CardTitle>
            <CardDescription>{t("votesDescription")}</CardDescription>
          </div>
          {canOpenLiveVote ? (
            <Button type="button" size="sm" variant="secondary" onClick={() => setVoteOpen(true)}>
              {t("openVoteButton")}
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
              <Spinner className="size-4" />
              {tCommon("loading")}
            </div>
          ) : votes.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("votesEmpty")}</p>
          ) : (
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columnTitle")}</TableHead>
                    <TableHead>{t("columnStatus")}</TableHead>
                    <TableHead className="w-[1%]">{t("columnActions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {votes.map((v) => {
                    const res = !v.isOpen ? parseVoteResult(v.resultJson) : null;
                    return (
                      <TableRow key={v.id}>
                        <TableCell className="max-w-[240px]">
                          <div className="font-medium">{v.title}</div>
                          <div className="text-muted-foreground text-xs">{v.question}</div>
                          {v.visibility === "SECRET" ? (
                            <p className="text-muted-foreground mt-1 text-xs">{t("secretVoteHint")}</p>
                          ) : null}
                          {res ? (
                            <div className="text-muted-foreground mt-2 space-y-1 text-xs">
                              <p>
                                {t("resultTotals", {
                                  yes: res.yes ?? 0,
                                  no: res.no ?? 0,
                                  abstain: res.abstain ?? 0,
                                })}
                              </p>
                              {v.rule === "ROLE_WEIGHTED" &&
                              res.weightedYes != null &&
                              res.weightedNo != null ? (
                                <p>
                                  {t("weightedTotals", {
                                    wy: res.weightedYes,
                                    wn: res.weightedNo,
                                    wa: res.weightedAbstain ?? 0,
                                  })}
                                </p>
                              ) : null}
                              {res.explanationKey ? (
                                <p>
                                  {t("resultOutcome")}: {outcomeLabel(res.explanationKey)}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </TableCell>
                        <TableCell>{v.isOpen ? t("statusOpen") : t("statusClosed")}</TableCell>
                        <TableCell>
                          {v.isOpen ? (
                            <div className="flex flex-wrap gap-1">
                              {(["YES", "NO", "ABSTAIN"] as const).map((c) => (
                                <Button
                                  key={c}
                                  type="button"
                                  size="sm"
                                  variant={myChoice(v) === c ? "default" : "outline"}
                                  disabled={castingId === v.id}
                                  onClick={() => void cast(v.id, c)}
                                >
                                  {c === "YES"
                                    ? t("choiceYes")
                                    : c === "NO"
                                      ? t("choiceNo")
                                      : t("choiceAbstain")}
                                </Button>
                              ))}
                              {canOpenLiveVote ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="destructive"
                                  disabled={closingId === v.id}
                                  onClick={() => void closeVote(v.id)}
                                >
                                  {closingId === v.id ? (
                                    <Spinner className="size-4" />
                                  ) : null}
                                  {t("closeVote")}
                                </Button>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {canRecordLiveDecision ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle>{t("decisionFormTitle")}</CardTitle>
            <CardDescription>{t("decisionFormDescription")}</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...decisionForm}>
              <form onSubmit={onRecordDecision} className="space-y-4">
                <FormField
                  control={decisionForm.control}
                  name="agendaItemId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("agendaItemLabel")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("agendaItemPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">{t("agendaItemNone")}</SelectItem>
                          {agenda.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {agendaTitle(a)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <I18nFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={decisionForm.control}
                  name="proposedById"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("proposedByLabel")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("noneSelect")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">{t("noneSelect")}</SelectItem>
                          {invitees.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <I18nFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={decisionForm.control}
                  name="ownerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("ownerLabel")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("noneSelect")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">{t("noneSelect")}</SelectItem>
                          {invitees.map((u) => (
                            <SelectItem key={u.id} value={u.id}>
                              {u.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <I18nFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={decisionForm.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("dueDateLabel")}</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <I18nFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={decisionForm.control}
                  name="requiresVote"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                      <FormLabel>{t("requiresVoteLabel")}</FormLabel>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={decisionForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("notesLabel")}</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={2} />
                      </FormControl>
                      <I18nFormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={decisionForm.control}
                  name="decisionText"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("decisionTextLabel")}</FormLabel>
                      <FormControl>
                        <Textarea {...field} rows={4} />
                      </FormControl>
                      <I18nFormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit">{t("recordDecision")}</Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>{t("timelineTitle")}</CardTitle>
          <CardDescription>{t("timelineDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {decisions.length === 0 ? (
            <p className="text-muted-foreground text-sm">{t("timelineEmpty")}</p>
          ) : (
            <ul className="space-y-4 text-sm">
              {decisions.map((d) => (
                <li key={d.id} className="border-b pb-4 last:border-0">
                  <div className="flex flex-wrap items-center gap-2">
                    {statusBadge(d.status, d.approved)}
                    {d.agendaItem ? (
                      <span className="text-muted-foreground text-xs">
                        {t("agendaLabel")}: {agendaTitle(d.agendaItem)}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground mt-1 text-xs">
                    {d.recordedBy.name} · {formatDateTime(d.eventAt, locale)}
                    {d.proposedBy ? (
                      <>
                        {" · "}
                        {t("proposedByLabel")}: {d.proposedBy.name}
                      </>
                    ) : null}
                    {d.owner ? (
                      <>
                        {" · "}
                        {t("ownerLabel")}: {d.owner.name}
                      </>
                    ) : null}
                    {d.dueDate ? (
                      <>
                        {" · "}
                        {t("dueDateLabel")}: {formatDateTime(d.dueDate, locale)}
                      </>
                    ) : null}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{d.decisionText}</p>
                  {d.notes ? (
                    <p className="text-muted-foreground mt-1 text-xs whitespace-pre-wrap">
                      {d.notes}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canApproveLiveDecision &&
                    (d.status === "DRAFT" || d.status === "IN_REVIEW") ? (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => void patchDecision(d.id, { action: "approve" })}
                          disabled={savingDecision}
                        >
                          {t("approveDecision")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => void patchDecision(d.id, { action: "reject" })}
                          disabled={savingDecision}
                        >
                          {t("rejectDecision")}
                        </Button>
                      </>
                    ) : null}
                    {canRecordLiveDecision ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setEditDecision(d);
                          setEditText(d.decisionText);
                          setEditNotes(d.notes ?? "");
                        }}
                      >
                        {t("editDecision")}
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={voteOpen} onOpenChange={setVoteOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("openVoteDialogTitle")}</DialogTitle>
          </DialogHeader>
          <Form {...openVoteForm}>
            <form onSubmit={onOpenVote} className="space-y-4">
              <FormField
                control={openVoteForm.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("voteTitleLabel")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={openVoteForm.control}
                name="question"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("voteQuestionLabel")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} rows={3} />
                    </FormControl>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={openVoteForm.control}
                name="visibility"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("visibilityLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="PUBLIC">{t("visibilityPublic")}</SelectItem>
                        <SelectItem value="SECRET">{t("visibilitySecret")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={openVoteForm.control}
                name="rule"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("ruleLabel")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="MAJORITY">{t("ruleMajority")}</SelectItem>
                        <SelectItem value="QUORUM_GATED">{t("ruleQuorumGated")}</SelectItem>
                        <SelectItem value="ROLE_WEIGHTED">{t("ruleRoleWeighted")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={openVoteForm.control}
                name="quorumRequired"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3">
                    <FormLabel>{t("quorumRequiredLabel")}</FormLabel>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <Alert>
                <AlertDescription>{t("secretVoteHint")}</AlertDescription>
              </Alert>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setVoteOpen(false)}>
                  {tCommon("cancel")}
                </Button>
                <Button type="submit">{t("submitOpenVote")}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={editDecision != null}
        onOpenChange={(o) => {
          if (!o) setEditDecision(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("editDecision")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={5}
            />
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
              placeholder={t("notesLabel")}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setEditDecision(null)}>
              {tCommon("cancel")}
            </Button>
            <Button type="button" disabled={savingDecision} onClick={() => void saveEditDecision()}>
              {savingDecision ? <Spinner className="size-4" /> : null}
              {t("saveDecision")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
