"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type { LiveVoteChoice } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { z } from "zod";

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

type LiveVoteRow = {
  id: string;
  title: string;
  question: string;
  isOpen: boolean;
  ballots: { userId: string; choice: LiveVoteChoice }[];
};

type LiveDecisionRow = {
  id: string;
  decisionText: string;
  eventAt: string;
  recordedBy: { id: string; name: string };
};

const openVoteSchema = z.object({
  title: z.string().min(3).max(200),
  question: z.string().min(3).max(2000),
});

const recordDecisionSchema = z.object({
  decisionText: z.string().min(5).max(5000),
  agendaItemId: z.string(),
});

type OpenVoteValues = z.infer<typeof openVoteSchema>;
type RecordDecisionValues = z.infer<typeof recordDecisionSchema>;

type LiveGovernancePanelProps = {
  meetingId: string;
  meetingIsLive: boolean;
  currentUserId: string;
  agenda: AgendaOption[];
  locale: "ar" | "en";
  canOpenLiveVote: boolean;
  canRecordLiveDecision: boolean;
};

export function LiveGovernancePanel({
  meetingId,
  meetingIsLive,
  currentUserId,
  agenda,
  locale,
  canOpenLiveVote,
  canRecordLiveDecision,
}: LiveGovernancePanelProps) {
  const t = useTranslations("meetings.liveGovernance");
  const tCommon = useTranslations("common");
  const [votes, setVotes] = useState<LiveVoteRow[]>([]);
  const [decisions, setDecisions] = useState<LiveDecisionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [voteOpen, setVoteOpen] = useState(false);
  const [castingId, setCastingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

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
    defaultValues: { title: "", question: "" },
  });

  const decisionForm = useForm<RecordDecisionValues>({
    resolver: zodResolver(recordDecisionSchema),
    defaultValues: { decisionText: "", agendaItemId: "_none" },
  });

  const onOpenVote = openVoteForm.handleSubmit(async (values) => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/votes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("voteOpenedToast"));
      setVoteOpen(false);
      openVoteForm.reset();
      await loadData();
    } catch {
      toast.error(tCommon("errorOccurred"));
    }
  });

  const onRecordDecision = decisionForm.handleSubmit(async (values) => {
    try {
      const agendaItemId =
        values.agendaItemId === "_none" ? null : values.agendaItemId;
      const res = await fetch(`/api/meetings/${meetingId}/live/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          decisionText: values.decisionText,
          agendaItemId,
        }),
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("decisionRecordedToast"));
      decisionForm.reset();
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

  if (!meetingIsLive) {
    return null;
  }

  const myChoice = (vote: LiveVoteRow) =>
    vote.ballots.find((b) => b.userId === currentUserId)?.choice ?? null;

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
                  {votes.map((v) => (
                    <TableRow key={v.id}>
                      <TableCell className="max-w-[240px]">
                        <div className="font-medium">{v.title}</div>
                        <div className="text-muted-foreground text-xs">{v.question}</div>
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
                  ))}
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
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={t("agendaItemPlaceholder")} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">{t("agendaItemNone")}</SelectItem>
                          {agenda.map((a) => (
                            <SelectItem key={a.id} value={a.id}>
                              {a.titleAr}
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
            <ul className="space-y-3 text-sm">
              {decisions.map((d) => (
                <li key={d.id} className="border-b pb-3 last:border-0">
                  <p className="text-muted-foreground text-xs">
                    {d.recordedBy.name} ·{" "}
                    {formatDateTime(d.eventAt, locale)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap">{d.decisionText}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={voteOpen} onOpenChange={setVoteOpen}>
        <DialogContent>
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
    </div>
  );
}
