"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import type {
  InvitationStatus,
  MeetingStatus,
  MeetingType,
  Plan,
} from "@prisma/client";
import {
  Archive,
  ArrowLeft,
  Ban,
  CalendarDays,
  Circle,
  Clock,
  FileCheck,
  FilePlus,
  FileText,
  Pencil,
  Radio,
  Trash2,
  Vote,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { I18nFormMessage } from "@/components/forms/i18n-form-message";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { EditMeetingSheet } from "@/components/meetings/edit-meeting-sheet";
import { CCOSLiveTab } from "@/components/meetings/CCOSLiveTab";
import { DecisionsTab } from "@/components/meetings/DecisionsTab";
import { DelegationsSection } from "@/components/meetings/DelegationsSection";
import { MinutesTab } from "@/components/meetings/MinutesTab";
import { VotingTab } from "@/components/meetings/VotingTab";
import { getRoleLabel } from "@/lib/board-roles";
import type { MeetingDetailDTO } from "@/lib/meeting-detail-include";
import {
  formatDateTime,
  formatDuration,
  formatFileSize,
  formatRelativeTime,
} from "@/lib/format";
import { getMeetingTypeLabel } from "@/lib/meeting-types";
import {
  getStatusBadgeClassName,
  getStatusLabel,
  getStatusVariant,
} from "@/lib/meeting-status";
import { Link, useRouter } from "@/lib/i18n/routing";
import type { QuorumDTO } from "@/lib/meeting-quorum";
import type { MeetingDetailTab } from "@/lib/meeting-detail-tab";
import { usePermissions } from "@/lib/permissions-context";
import { uploadFile } from "@/lib/upload";
import { agendaItemBodySchema } from "@/lib/validations/meeting-apis";
import { cn } from "@/lib/utils";
import { z } from "zod";

type AgendaFormValues = z.infer<typeof agendaItemBodySchema>;

type AgendaStatRow = {
  agendaItemId: string;
  votes: number;
  decisions: number;
};

type LivePollPayload = {
  status: MeetingStatus;
  invitations: MeetingDetailDTO["invitations"];
  votesCount: number;
  decisionsCount: number;
  openVotesCount?: number;
  openDecisionsCount?: number;
  agendaStats?: AgendaStatRow[];
  attendedCount: number;
  totalInvited: number;
  quorum?: QuorumDTO | null;
};

function isHttpUrl(location: string | null | undefined): boolean {
  if (!location?.trim()) return false;
  return /^https?:\/\//i.test(location.trim());
}

function meetingTypeDisplay(
  type: MeetingType,
  customMeetingType: string | null,
  locale: "ar" | "en",
): string {
  const base = getMeetingTypeLabel(type, locale);
  if (
    (type === "STRATEGIC" || type === "EMERGENCY") &&
    customMeetingType?.trim()
  ) {
    return `${base} — ${customMeetingType.trim()}`;
  }
  return base;
}

function invitationStatusLabel(
  status: InvitationStatus,
  t: (key: string) => string,
): string {
  switch (status) {
    case "PENDING":
      return t("invitationStatusPENDING");
    case "ACCEPTED":
      return t("invitationStatusACCEPTED");
    case "DECLINED":
      return t("invitationStatusDECLINED");
    case "TENTATIVE":
      return t("invitationStatusTENTATIVE");
    default:
      return status;
  }
}

function rsvpBadgeVariant(
  status: InvitationStatus,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "ACCEPTED":
      return "default";
    case "DECLINED":
      return "destructive";
    case "TENTATIVE":
      return "outline";
    default:
      return "secondary";
  }
}

type ActionKey =
  | "start"
  | "end"
  | "archive"
  | "cancel"
  | "delete"
  | "agenda-save"
  | "agenda-delete"
  | "attachment"
  | "rsvp";

function MeetingStatusBanner({
  status,
  locale,
  scheduledAt,
}: {
  status: MeetingStatus;
  locale: "ar" | "en";
  scheduledAt: Date | string;
}) {
  const t = useTranslations("meetings");

  if (status === "LIVE") {
    return (
      <Alert
        className={cn(
          "border-green-600 bg-green-50 text-green-950",
          "dark:border-green-700 dark:bg-green-950/50 dark:text-green-50",
        )}
      >
        <Circle
          className="size-3 shrink-0 fill-green-600 text-green-600 animate-pulse"
          aria-hidden
        />
        <AlertTitle>{t("bannerLiveTitle")}</AlertTitle>
      </Alert>
    );
  }

  if (status === "ENDED") {
    return (
      <Alert className="bg-muted text-foreground border-border">
        <Clock className="text-muted-foreground" />
        <AlertTitle>{t("bannerEndedTitle")}</AlertTitle>
      </Alert>
    );
  }

  if (status === "CANCELLED") {
    return (
      <Alert variant="destructive">
        <Ban className="text-current" />
        <AlertTitle>{t("bannerCancelledTitle")}</AlertTitle>
      </Alert>
    );
  }

  if (status === "SCHEDULED") {
    return (
      <Alert
        className={cn(
          "border-blue-500/40 bg-blue-50/90 text-foreground",
          "dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-foreground",
        )}
      >
        <CalendarDays className="text-blue-700 dark:text-blue-300" />
        <AlertTitle>{t("bannerScheduledTitle")}</AlertTitle>
        <AlertDescription>
          <span className="text-muted-foreground block">
            {formatDateTime(scheduledAt, locale)} ·{" "}
            {formatRelativeTime(scheduledAt, locale)}
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}

function MeetingQuorumBanner({
  quorum,
  locale,
}: {
  quorum: QuorumDTO;
  locale: "ar" | "en";
}) {
  const t = useTranslations("quorum");
  if (!quorum.required) return null;

  if (quorum.met) {
    return (
      <Alert
        className={cn(
          "border-emerald-600/40 bg-emerald-50/90 text-emerald-950",
          "dark:border-emerald-700/50 dark:bg-emerald-950/40 dark:text-emerald-50",
        )}
      >
        <Circle className="size-4 shrink-0 text-emerald-600" aria-hidden />
        <AlertTitle>
          {t("bannerMet", {
            current: quorum.current,
            threshold: quorum.threshold,
          })}
        </AlertTitle>
      </Alert>
    );
  }

  return (
    <Alert
      className={cn(
        "border-amber-600/50 bg-amber-50/95 text-amber-950",
        "dark:border-amber-600/40 dark:bg-amber-950/45 dark:text-amber-50",
      )}
    >
      <Circle className="size-4 shrink-0 text-amber-600" aria-hidden />
      <AlertTitle>
        {t("bannerNotMet", {
          threshold: quorum.threshold,
          total: quorum.total,
        })}
      </AlertTitle>
    </Alert>
  );
}

export function MeetingDetailClient({
  meeting: initialMeeting,
  locale,
  currentUserId,
  currentUserName,
  initialQuorum,
  initialOpenVotesCount,
  initialOpenDecisionsCount,
  initialAgendaStats,
  initialActiveTab = "agenda",
  tenantPlan,
}: {
  meeting: MeetingDetailDTO;
  locale: "ar" | "en";
  currentUserId: string;
  currentUserName: string;
  initialQuorum: QuorumDTO | null;
  initialOpenVotesCount: number;
  initialOpenDecisionsCount: number;
  initialAgendaStats: AgendaStatRow[];
  initialActiveTab?: MeetingDetailTab;
  tenantPlan: Plan;
}) {
  const perms = usePermissions();
  const t = useTranslations("meetings");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [meeting, setMeeting] = useState<MeetingDetailDTO>(initialMeeting);
  const [action, setAction] = useState<ActionKey | null>(null);
  const [deleteMeetingOpen, setDeleteMeetingOpen] = useState(false);
  const [deleteAgendaOpen, setDeleteAgendaOpen] = useState(false);
  const [agendaToDeleteId, setAgendaToDeleteId] = useState<string | null>(null);
  const [agendaDialogOpen, setAgendaDialogOpen] = useState(false);
  const [editingAgendaId, setEditingAgendaId] = useState<string | null>(null);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [cancelMeetingOpen, setCancelMeetingOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [quorum, setQuorum] = useState<QuorumDTO | null>(initialQuorum);
  const [activeTab, setActiveTab] = useState<string>(initialActiveTab);
  const [openVotesTabCount, setOpenVotesTabCount] = useState(
    initialOpenVotesCount,
  );
  const [openDecisionsTabCount, setOpenDecisionsTabCount] = useState(
    initialOpenDecisionsCount,
  );
  const [agendaStatsById, setAgendaStatsById] = useState<
    Record<string, { votes: number; decisions: number }>
  >(() =>
    Object.fromEntries(
      initialAgendaStats.map((r) => [
        r.agendaItemId,
        { votes: r.votes, decisions: r.decisions },
      ]),
    ),
  );
  const [decisionCreatePrefill, setDecisionCreatePrefill] = useState<{
    key: number;
    textAr: string;
    agendaItemId: string | null;
  } | null>(null);

  const clearDecisionPrefill = useCallback(() => {
    setDecisionCreatePrefill(null);
  }, []);

  const handleVoteConvertToDecision = useCallback(
    (draft: { textAr: string; agendaItemId: string | null }) => {
      setDecisionCreatePrefill({ key: Date.now(), ...draft });
      setActiveTab("decisions");
    },
    [],
  );

  useEffect(() => {
    setMeeting(initialMeeting);
  }, [initialMeeting]);

  useEffect(() => {
    setOpenVotesTabCount(initialOpenVotesCount);
    setOpenDecisionsTabCount(initialOpenDecisionsCount);
    setAgendaStatsById(
      Object.fromEntries(
        initialAgendaStats.map((r) => [
          r.agendaItemId,
          { votes: r.votes, decisions: r.decisions },
        ]),
      ),
    );
  }, [initialOpenVotesCount, initialOpenDecisionsCount, initialAgendaStats]);

  useEffect(() => {
    if (meeting.status !== "LIVE") {
      setQuorum(null);
      return;
    }
    setQuorum(initialQuorum);
  }, [meeting.status, meeting.id, initialQuorum]);

  useEffect(() => {
    if (
      meeting.status === "CANCELLED" ||
      meeting.status === "ARCHIVED"
    ) {
      return;
    }

    const poll = async () => {
      try {
        const res = await fetch(`/api/meetings/${meeting.id}/live`, {
          credentials: "include",
        });
        if (!res.ok) return;
        const data = (await res.json()) as LivePollPayload;
        setMeeting((prev) => ({
          ...prev,
          status: data.status,
          invitations: data.invitations,
          _count: {
            votes: data.votesCount,
            decisions: data.decisionsCount,
          },
        }));
        if (typeof data.openVotesCount === "number") {
          setOpenVotesTabCount(data.openVotesCount);
        }
        if (typeof data.openDecisionsCount === "number") {
          setOpenDecisionsTabCount(data.openDecisionsCount);
        }
        if (Array.isArray(data.agendaStats)) {
          setAgendaStatsById(
            Object.fromEntries(
              data.agendaStats.map((r) => [
                r.agendaItemId,
                { votes: r.votes, decisions: r.decisions },
              ]),
            ),
          );
        }
        if (data.status === "LIVE" && data.quorum !== undefined) {
          setQuorum(data.quorum ?? null);
        } else if (data.status !== "LIVE") {
          setQuorum(null);
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const ms = meeting.status === "LIVE" ? 10_000 : 30_000;
    const id = window.setInterval(() => void poll(), ms);
    return () => window.clearInterval(id);
  }, [meeting.id, meeting.status]);

  const agendaForm = useForm<AgendaFormValues>({
    resolver: zodResolver(agendaItemBodySchema),
    defaultValues: {
      titleAr: "",
      titleEn: "",
      notes: "",
    },
  });

  const openAddAgenda = () => {
    setEditingAgendaId(null);
    agendaForm.reset({ titleAr: "", titleEn: "", notes: "" });
    setAgendaDialogOpen(true);
  };

  const openEditAgenda = (item: MeetingDetailDTO["agenda"][number]) => {
    setEditingAgendaId(item.id);
    agendaForm.reset({
      titleAr: item.titleAr,
      titleEn: item.titleEn ?? "",
      notes: item.notes ?? "",
    });
    setAgendaDialogOpen(true);
  };

  const canEditAgenda =
    perms.canEditMeetings &&
    (meeting.status === "SCHEDULED" || meeting.status === "LIVE");

  const hasLegacyExternalLink =
    Boolean(meeting.location?.trim()) && isHttpUrl(meeting.location);
  const physicalVenue =
    meeting.location?.trim() && !isHttpUrl(meeting.location)
      ? meeting.location.trim()
      : null;

  const attendedCount = useMemo(
    () =>
      meeting.invitations.filter((i) => i.attendanceCheckedInAt != null)
        .length,
    [meeting.invitations],
  );

  const isLiveInvitee = useMemo(
    () => meeting.invitations.some((i) => i.userId === currentUserId),
    [meeting.invitations, currentUserId],
  );

  const patchMeetingStatus = async (
    status: MeetingStatus,
    options?: { successToast?: boolean; onSuccess?: () => void },
  ) => {
    const actionKey: ActionKey =
      status === "LIVE"
        ? "start"
        : status === "ENDED"
          ? "end"
          : status === "ARCHIVED"
            ? "archive"
            : status === "CANCELLED"
              ? "cancel"
              : "start";
    setAction(actionKey);
    const showToast = options?.successToast !== false;
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(body);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      setMeeting(body as MeetingDetailDTO);
      if (showToast) {
        toast.success(t("meetingUpdated"));
      }
      options?.onSuccess?.();
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    } finally {
      setAction(null);
    }
  };

  const confirmDeleteMeeting = async () => {
    setAction("delete");
    try {
      const res = await fetch(`/api/meetings/${meeting.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const delBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(delBody);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      toast.success(t("meetingDeleted"));
      setDeleteMeetingOpen(false);
      router.push("/meetings");
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    } finally {
      setAction(null);
    }
  };

  const onAgendaSubmit = agendaForm.handleSubmit(async (values) => {
    setAction("agenda-save");
    try {
      const isEdit = Boolean(editingAgendaId);
      const res = await fetch(
        isEdit
          ? `/api/agenda/${editingAgendaId}`
          : `/api/meetings/${meeting.id}/agenda`,
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(values),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(body);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      setMeeting(body as MeetingDetailDTO);
      toast.success(t("agendaSaved"));
      setAgendaDialogOpen(false);
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    } finally {
      setAction(null);
    }
  });

  const runDeleteAgenda = async () => {
    if (!agendaToDeleteId) return;
    setAction("agenda-delete");
    try {
      const res = await fetch(`/api/agenda/${agendaToDeleteId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(body);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      setMeeting(body as MeetingDetailDTO);
      toast.success(t("agendaSaved"));
      setDeleteAgendaOpen(false);
      setAgendaToDeleteId(null);
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    } finally {
      setAction(null);
    }
  };

  const onRsvp = async (invitationId: string, status: InvitationStatus) => {
    setAction("rsvp");
    try {
      const res = await fetch(`/api/invitations/${invitationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      const inv = await res.json().catch(() => null);
      if (!res.ok || !inv) {
        console.error(inv);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      setMeeting((prev) => ({
        ...prev,
        invitations: prev.invitations.map((i) =>
          i.id === invitationId ? { ...i, ...inv } : i,
        ),
      }));
      toast.success(t("rsvpUpdated"));
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    } finally {
      setAction(null);
    }
  };

  const onAttachmentSelected = async () => {
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) return;
    setAction("attachment");
    try {
      const uploaded = await uploadFile(file, "/ccos/attachments");
      const res = await fetch(`/api/meetings/${meeting.id}/attachments`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: uploaded.url,
          name: uploaded.name,
          mime: uploaded.mime,
          size: uploaded.size,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(body);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      setMeeting(body as MeetingDetailDTO);
      toast.success(t("attachmentUploaded"));
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : tCommon("errorOccurred"),
      );
    } finally {
      if (input) input.value = "";
      setAction(null);
    }
  };

  const deleteAttachment = async (attId: string) => {
    setAction("attachment");
    try {
      const res = await fetch(`/api/attachments/${attId}`, {
        method: "DELETE",
        credentials: "include",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.error(body);
        toast.error(tCommon("errorOccurred"));
        return;
      }
      setMeeting(body as MeetingDetailDTO);
      toast.success(t("attachmentDeleted"));
      router.refresh();
    } catch (e) {
      console.error(e);
      toast.error(tCommon("errorOccurred"));
    } finally {
      setAction(null);
    }
  };

  const badgeVariant = getStatusVariant(meeting.status);
  const badgeExtra = getStatusBadgeClassName(meeting.status);

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 pb-12">
      <MeetingStatusBanner
        status={meeting.status}
        locale={locale}
        scheduledAt={meeting.scheduledAt}
      />

      <DashboardBreadcrumbs
        items={[
          { href: "/dashboard", label: tNav("dashboard") },
          { href: "/meetings", label: tNav("meetings") },
          { label: meeting.title },
        ]}
      />

      <EditMeetingSheet
        open={editSheetOpen}
        onOpenChange={setEditSheetOpen}
        meeting={meeting}
        locale={locale}
        onSaved={(m) => {
          setMeeting(m);
          router.refresh();
        }}
      />

      <div className="flex flex-col gap-4">
        <Button variant="ghost" size="sm" className="w-fit gap-2 ps-0" asChild>
          <Link href="/meetings">
            <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden />
            {t("backToList")}
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                {meeting.title}
              </h1>
              <Badge
                variant={badgeVariant}
                className={cn("shrink-0", badgeExtra)}
              >
                {getStatusLabel(meeting.status, locale)}
              </Badge>
            </div>
            <p className="text-muted-foreground text-sm">
              {meetingTypeDisplay(
                meeting.type,
                meeting.customMeetingType,
                locale,
              )}
            </p>
            <p className="text-muted-foreground text-sm">
              {formatDateTime(meeting.scheduledAt, locale)} ·{" "}
              {formatDuration(meeting.durationMin, locale)}
            </p>
            {physicalVenue ? (
              <p className="text-muted-foreground text-sm">
                <span className="font-medium text-foreground">
                  {t("physicalVenueLabel")}
                </span>{" "}
                {physicalVenue}
              </p>
            ) : null}
            {hasLegacyExternalLink ? (
              <p className="text-muted-foreground max-w-2xl text-sm leading-relaxed">
                {t("ccosLiveLegacyLinkNotice")}
              </p>
            ) : null}
            {meeting.objectives ? (
              <p className="text-muted-foreground max-w-3xl text-sm leading-relaxed">
                {meeting.objectives}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {perms.canEditMeetings && meeting.status === "SCHEDULED" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={action !== null}
              onClick={() => setEditSheetOpen(true)}
            >
              <Pencil className="size-4" />
              {tCommon("edit")}
            </Button>
          ) : null}

          {perms.canManageMeetings && meeting.status === "SCHEDULED" ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={action !== null}
              onClick={() => setCancelMeetingOpen(true)}
            >
              {t("cancelMeeting")}
            </Button>
          ) : null}

          {perms.canManageMeetings && meeting.status === "SCHEDULED" ? (
            <Button
              variant="default"
              size="sm"
              disabled={action !== null}
              onClick={() => patchMeetingStatus("LIVE")}
            >
              {action === "start" ? (
                <Spinner className="size-4" />
              ) : null}
              {t("startMeeting")}
            </Button>
          ) : null}

          {perms.canManageMeetings && meeting.status === "LIVE" ? (
            <Button
              variant="secondary"
              size="sm"
              disabled={action !== null}
              onClick={() => patchMeetingStatus("ENDED")}
            >
              {action === "end" ? <Spinner className="size-4" /> : null}
              {t("endMeeting")}
            </Button>
          ) : null}

          {perms.canManageMeetings && meeting.status === "ENDED" ? (
            <Button
              variant="outline"
              size="sm"
              disabled={action !== null}
              onClick={() => patchMeetingStatus("ARCHIVED")}
            >
              {action === "archive" ? <Spinner className="size-4" /> : null}
              <Archive className="size-4" />
              {t("archive")}
            </Button>
          ) : null}

          {meeting.status === "ENDED" || meeting.status === "ARCHIVED" ? (
            meeting.minutes ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/meetings/${meeting.id}/minutes`}>
                  <FileText className="size-4" aria-hidden />
                  {t("viewMinutesLink")}
                </Link>
              </Button>
            ) : perms.canFinalizeMinutes ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setActiveTab("minutes")}
              >
                <FilePlus className="size-4" aria-hidden />
                {t("generateMinutesLink")}
              </Button>
            ) : null
          ) : null}

          {perms.canManageMeetings ? (
            <Button
              variant="destructive"
              size="sm"
              disabled={action !== null}
              onClick={() => setDeleteMeetingOpen(true)}
            >
              {tCommon("delete")}
            </Button>
          ) : null}
        </div>
      </div>

      {meeting.status === "LIVE" && quorum ? (
        <MeetingQuorumBanner quorum={quorum} locale={locale} />
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="gap-4"
      >
        <TabsList className="inline-flex h-auto w-full max-w-full min-w-0 flex-nowrap justify-start gap-1 overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="agenda">{t("tabAgendaInvitees")}</TabsTrigger>
          <TabsTrigger value="live" className="gap-1.5">
            <Radio className="size-3.5 shrink-0 opacity-80" aria-hidden />
            {t("tabCCOSLive")}
          </TabsTrigger>
          <TabsTrigger value="votes" className="gap-1.5">
            {t("tabVoting")}
            <Badge
              variant="secondary"
              className="h-5 min-w-5 justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums"
            >
              {openVotesTabCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="decisions" className="gap-1.5">
            {t("tabDecisions")}
            <Badge
              variant="secondary"
              className="h-5 min-w-5 justify-center rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums"
            >
              {openDecisionsTabCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="minutes">{t("tabMinutes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="agenda" className="space-y-8">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("agendaSection")}</h2>
            <div className="space-y-4">
              {meeting.agenda.map((item, index) => (
                <Card key={item.id} className="shadow-sm">
                  <CardHeader className="flex flex-row items-start gap-3 space-y-0 pb-2">
                    <div className="bg-primary text-primary-foreground flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1">
                      <CardTitle className="text-base leading-snug">
                        {item.titleAr}
                      </CardTitle>
                      {item.titleEn ? (
                        <p className="text-muted-foreground text-sm">
                          {item.titleEn}
                        </p>
                      ) : null}
                      {item.notes ? (
                        <p className="text-muted-foreground text-xs leading-relaxed">
                          {item.notes}
                        </p>
                      ) : null}
                      <div className="text-muted-foreground flex flex-wrap items-center gap-3 pt-1 text-xs">
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/80 hover:text-foreground"
                          onClick={() => setActiveTab("votes")}
                        >
                          <Vote className="size-3.5 shrink-0 opacity-80" aria-hidden />
                          <span className="tabular-nums">
                            {agendaStatsById[item.id]?.votes ?? 0}
                          </span>
                        </button>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-colors hover:bg-muted/80 hover:text-foreground"
                          onClick={() => setActiveTab("decisions")}
                        >
                          <FileCheck
                            className="size-3.5 shrink-0 opacity-80"
                            aria-hidden
                          />
                          <span className="tabular-nums">
                            {agendaStatsById[item.id]?.decisions ?? 0}
                          </span>
                        </button>
                      </div>
                    </div>
                    {canEditAgenda ? (
                      <div className="flex shrink-0 gap-1">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={tCommon("edit")}
                          onClick={() => openEditAgenda(item)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          aria-label={t("deleteAgendaItem")}
                          onClick={() => {
                            setAgendaToDeleteId(item.id);
                            setDeleteAgendaOpen(true);
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    ) : null}
                  </CardHeader>
                  {item.attachments.length > 0 ? (
                    <CardContent className="border-t pt-3">
                      <ul className="text-muted-foreground space-y-1 text-xs">
                        {item.attachments.map((a) => (
                          <li key={a.id}>{a.name}</li>
                        ))}
                      </ul>
                    </CardContent>
                  ) : null}
                </Card>
              ))}
            </div>
            {canEditAgenda ? (
              <Button variant="outline" size="sm" onClick={openAddAgenda}>
                {t("addAgendaItem")}
              </Button>
            ) : null}
          </section>

          <section className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
              <h2 className="text-lg font-semibold">{t("inviteesSection")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("attendanceSummary", {
                  attended: attendedCount,
                  total: meeting.invitations.length,
                })}
              </p>
            </div>
            <Card className="shadow-sm">
              <CardContent className="p-0">
                <div className="w-full overflow-x-auto">
                  <Table className="min-w-[640px]">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("tableName")}</TableHead>
                      <TableHead>{t("tableRole")}</TableHead>
                      <TableHead>{t("tableRsvp")}</TableHead>
                      <TableHead>{t("tableCheckedIn")}</TableHead>
                      <TableHead className="w-[1%]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {meeting.invitations.map((inv) => {
                      const mine = inv.userId === currentUserId;
                      return (
                        <TableRow key={inv.id}>
                          <TableCell className="font-medium">
                            {inv.user.name}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className="font-normal">
                              {getRoleLabel(inv.role, locale)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={rsvpBadgeVariant(inv.status)}>
                              {invitationStatusLabel(inv.status, t)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {inv.attendanceCheckedInAt
                              ? formatDateTime(
                                  inv.attendanceCheckedInAt,
                                  locale,
                                )
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {mine ? (
                              <ButtonGroup className="flex-wrap">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={action !== null}
                                  onClick={() =>
                                    onRsvp(inv.id, "ACCEPTED")
                                  }
                                >
                                  {t("rsvpAccept")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={action !== null}
                                  onClick={() =>
                                    onRsvp(inv.id, "DECLINED")
                                  }
                                >
                                  {t("rsvpDecline")}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={action !== null}
                                  onClick={() =>
                                    onRsvp(inv.id, "TENTATIVE")
                                  }
                                >
                                  {t("rsvpTentative")}
                                </Button>
                              </ButtonGroup>
                            ) : null}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                </div>
              </CardContent>
            </Card>
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{t("attachmentsSection")}</h2>
            <Card className="shadow-sm">
              <CardContent className="flex flex-col gap-4 p-4">
                {perms.canEditMeetings ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      ref={fileInputRef}
                      type="file"
                      className="max-w-xs cursor-pointer"
                      disabled={action === "attachment"}
                    />
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={action === "attachment"}
                      onClick={() => void onAttachmentSelected()}
                    >
                      {action === "attachment" ? (
                        <Spinner className="size-4" />
                      ) : null}
                      {t("uploadAttachment")}
                    </Button>
                  </div>
                ) : null}
                <ul className="space-y-2">
                  {meeting.attachments.length === 0 ? (
                    <li className="text-muted-foreground text-sm">—</li>
                  ) : (
                    meeting.attachments.map((a) => (
                      <li
                        key={a.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="min-w-0 truncate font-medium">
                          {a.name}
                          <span className="text-muted-foreground ms-2 font-normal">
                            ({formatFileSize(a.size, locale)})
                          </span>
                        </span>
                        <div className="flex shrink-0 items-center gap-2">
                          {a.url.startsWith("placeholder:") ? (
                            <span
                              className="text-muted-foreground text-xs"
                              title={t("placeholderDownload")}
                            >
                              {t("download")}
                            </span>
                          ) : (
                            <a
                              href={a.url}
                              className="text-primary text-xs underline-offset-4 hover:underline"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {t("download")}
                            </a>
                          )}
                          {perms.canEditMeetings ? (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="text-destructive size-8"
                              aria-label={tCommon("delete")}
                              disabled={action === "attachment"}
                              onClick={() => void deleteAttachment(a.id)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          ) : null}
                        </div>
                      </li>
                    ))
                  )}
                </ul>
              </CardContent>
            </Card>
          </section>

          <DelegationsSection
            meetingId={meeting.id}
            currentUserId={currentUserId}
            locale={locale}
            tenantPlan={tenantPlan}
            invitees={meeting.invitations.map((inv) => ({
              userId: inv.userId,
              user: {
                id: inv.user.id,
                name: inv.user.name,
                role: inv.user.role,
              },
            }))}
          />
        </TabsContent>

        <TabsContent value="live" className="space-y-4">
          <CCOSLiveTab
            meetingId={meeting.id}
            meetingStatus={meeting.status}
            locale={locale}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
            agenda={meeting.agenda.map((a) => ({
              id: a.id,
              titleAr: a.titleAr,
              titleEn: a.titleEn ?? null,
            }))}
            invitees={meeting.invitations.map((inv) => ({
              id: inv.user.id,
              name: inv.user.name,
            }))}
            canManageMeetings={perms.canManageMeetings}
            canUseAiTranscriptDraft={
              perms.canFinalizeMinutes || perms.canManageMeetings
            }
            isInvitee={isLiveInvitee}
            onMeetingUpdated={() => router.refresh()}
          />
        </TabsContent>

        <TabsContent value="votes">
          <VotingTab
            meetingId={meeting.id}
            currentUserId={currentUserId}
            isLive={meeting.status === "LIVE"}
            locale={locale}
            quorum={quorum}
            onConvertToDecision={handleVoteConvertToDecision}
            agenda={meeting.agenda.map((item) => ({
              id: item.id,
              titleAr: item.titleAr,
              titleEn: item.titleEn,
            }))}
          />
        </TabsContent>
        <TabsContent value="decisions">
          <DecisionsTab
            meetingId={meeting.id}
            agendaItems={meeting.agenda.map((item) => ({
              id: item.id,
              titleAr: item.titleAr,
              titleEn: item.titleEn,
            }))}
            invitees={meeting.invitations.map((inv) => ({
              id: inv.user.id,
              name: inv.user.name,
            }))}
            currentUserId={currentUserId}
            locale={locale}
            createPrefill={decisionCreatePrefill}
            onConsumeCreatePrefill={clearDecisionPrefill}
          />
        </TabsContent>
        <TabsContent value="minutes" className="space-y-4">
          <MinutesTab
            meetingId={meeting.id}
            currentUserId={currentUserId}
            locale={locale}
            meetingStatus={meeting.status}
            tenantPlan={tenantPlan}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={agendaDialogOpen} onOpenChange={setAgendaDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingAgendaId
                ? t("editAgendaDialogTitle")
                : t("addAgendaDialogTitle")}
            </DialogTitle>
          </DialogHeader>
          <Form {...agendaForm}>
            <form onSubmit={onAgendaSubmit} className="space-y-4">
              <FormField
                control={agendaForm.control}
                name="titleAr"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agendaTitleAr")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormDescription>{t("formHintAgendaItemTitleAr")}</FormDescription>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={agendaForm.control}
                name="titleEn"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agendaTitleEn")}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={agendaForm.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("agendaNotes")}</FormLabel>
                    <FormControl>
                      <Textarea {...field} value={field.value ?? ""} rows={3} />
                    </FormControl>
                    <I18nFormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setAgendaDialogOpen(false)}
                >
                  {tCommon("cancel")}
                </Button>
                <Button type="submit" disabled={action === "agenda-save"}>
                  {action === "agenda-save" ? (
                    <Spinner className="size-4" />
                  ) : null}
                  {t("saveAgenda")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={cancelMeetingOpen}
        onOpenChange={setCancelMeetingOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("cancelMeetingConfirmTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("cancelMeetingConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={action === "cancel"}
              onClick={(e) => {
                e.preventDefault();
                void patchMeetingStatus("CANCELLED", {
                  successToast: false,
                  onSuccess: () => {
                    setCancelMeetingOpen(false);
                    toast.success(t("meetingCancelledSuccess"));
                  },
                });
              }}
            >
              {action === "cancel" ? <Spinner className="size-4" /> : null}
              {t("cancelMeeting")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteMeetingOpen} onOpenChange={setDeleteMeetingOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteMeetingConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteMeetingConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={action === "delete"}
              onClick={(e) => {
                e.preventDefault();
                void confirmDeleteMeeting();
              }}
            >
              {action === "delete" ? <Spinner className="size-4" /> : null}
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAgendaOpen} onOpenChange={setDeleteAgendaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteAgendaConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteAgendaConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setAgendaToDeleteId(null);
              }}
            >
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={action === "agenda-delete"}
              onClick={(e) => {
                e.preventDefault();
                void runDeleteAgenda();
              }}
            >
              {action === "agenda-delete" ? (
                <Spinner className="size-4" />
              ) : null}
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
