"use client";

import type { MeetingStatus, Plan } from "@prisma/client";
import {
  Check,
  File as FileIcon,
  FileDown,
  FileText,
  Lock,
  PenTool,
  Pencil,
  RefreshCw,
  Save,
  Send,
  Trash2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  SignatureDrawCanvas,
  type SignatureDrawCanvasRef,
} from "@/components/meetings/SignatureDrawCanvas";
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
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MinutesHtmlEditor,
  MinutesHtmlEditorToolbar,
} from "@/components/meetings/minutes-html-editor";
import { LiveAiTranscriptDraftCard } from "@/components/meetings/LiveAiTranscriptDraftCard";
import { MinutesWorkflowStepper } from "@/components/meetings/minutes-workflow-stepper";
import { usePlanUpgrade } from "@/components/plan/plan-upgrade-provider";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { Link, useRouter } from "@/lib/i18n/routing";
import { usePermissions } from "@/lib/permissions-context";
import { getPlanLimits, type PlanLimitApiBody } from "@/lib/plan-limits-config";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";

export type MinutesSignatureDto = {
  id: string;
  userId: string;
  userName: string;
  role: string;
  roleLabel: string;
  signedAt: string;
  typedName: string | null;
  signatureImageUrl: string | null;
};

export type MinutesTabDto = {
  id: string;
  meetingId: string;
  contentHtml: string;
  generatedAt: string;
  finalizedAt: string | null;
  finalizedById: string | null;
  finalizedByName: string | null;
  adoptedDocumentUrl: string | null;
  adoptedDocumentName: string | null;
  adoptedDocumentMime: string | null;
  adoptedDocumentSize: number | null;
  adoptedAt: string | null;
  adoptedById: string | null;
  adoptedByName: string | null;
  attendeesNotifiedAt: string | null;
  signatures: MinutesSignatureDto[];
};

export function MinutesTab({
  meetingId,
  currentUserId,
  locale,
  meetingStatus,
  tenantPlan,
}: {
  meetingId: string;
  currentUserId: string;
  locale: "ar" | "en";
  meetingStatus: MeetingStatus;
  tenantPlan: Plan;
}) {
  const perms = usePermissions();
  const t = useTranslations("meetings");
  const tMin = useTranslations("minutes");
  const tCommon = useTranslations("common");
  const tPlan = useTranslations("planUpgrade");
  const router = useRouter();
  const { showPlanUpgrade, showPlanUpgradeFromApiBody } = usePlanUpgrade();
  const planLimits = useMemo(() => getPlanLimits(tenantPlan), [tenantPlan]);

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [minutes, setMinutes] = useState<MinutesTabDto | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editSession, setEditSession] = useState(0);
  const editorRef = useRef<HTMLDivElement>(null);
  const [draftHtml, setDraftHtml] = useState("");
  const reviewStorageKey = `ccos_minutes_review_saved_${meetingId}`;
  const [reviewSaveDone, setReviewSaveDone] = useState(false);

  const [signOpen, setSignOpen] = useState(false);
  const [signTab, setSignTab] = useState<"typed" | "draw">("typed");
  const [signTyped, setSignTyped] = useState("");
  const [signConfirm, setSignConfirm] = useState(false);
  const [canvasHasInk, setCanvasHasInk] = useState(false);
  const drawRef = useRef<SignatureDrawCanvasRef>(null);

  const [removeTarget, setRemoveTarget] = useState<MinutesSignatureDto | null>(
    null,
  );

  const [adoptOpen, setAdoptOpen] = useState(false);
  const [adoptPreview, setAdoptPreview] = useState<File | null>(null);

  const [notifyOpen, setNotifyOpen] = useState(false);

  const resetSignDialog = useCallback(() => {
    setSignTyped("");
    setSignConfirm(false);
    setSignTab("typed");
    setCanvasHasInk(false);
    drawRef.current?.clear();
  }, []);

  const loadMinutes = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/minutes?locale=${locale}`,
        { credentials: "include" },
      );
      if (res.status === 404) {
        setMinutes(null);
        return;
      }
      const body = (await res.json()) as { minutes?: MinutesTabDto; error?: string };
      if (!res.ok) {
        toast.error(body.error ?? tCommon("errorOccurred"));
        setMinutes(null);
        return;
      }
      if (body.minutes) {
        setMinutes(body.minutes);
        setDraftHtml(body.minutes.contentHtml);
      }
    } catch {
      toast.error(tCommon("errorOccurred"));
    } finally {
      setLoading(false);
    }
  }, [meetingId, locale, tCommon]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      void loadMinutes();
    });
  }, [loadMinutes]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      try {
        if (
          typeof window !== "undefined" &&
          window.sessionStorage.getItem(reviewStorageKey) === "1"
        ) {
          setReviewSaveDone(true);
        }
      } catch {
        /* ignore */
      }
    });
    return () => {
      cancelled = true;
    };
  }, [reviewStorageKey]);

  const markReviewSaved = useCallback(() => {
    try {
      sessionStorage.setItem(reviewStorageKey, "1");
    } catch {
      /* ignore */
    }
    setReviewSaveDone(true);
  }, [reviewStorageKey]);

  const canGenerate =
    perms.canFinalizeMinutes &&
    (meetingStatus === "ENDED" || meetingStatus === "ARCHIVED");

  const canUseAiTranscriptDraft =
    perms.canFinalizeMinutes || perms.canManageMeetings;

  const isFinalized = Boolean(minutes?.finalizedAt);
  const isAdopted = Boolean(minutes?.adoptedDocumentUrl && minutes?.adoptedAt);
  const attendeesNotified = Boolean(minutes?.attendeesNotifiedAt);
  const reviewSavedForStepper = Boolean(isFinalized || reviewSaveDone);

  const generate = async () => {
    setBusy("generate");
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/minutes?locale=${locale}`,
        { method: "POST", credentials: "include" },
      );
      const body = (await res.json()) as { minutes?: MinutesTabDto; error?: string };
      if (!res.ok) {
        toast.error(body.error ?? t("minutesGenerateError"));
        return;
      }
      if (body.minutes) {
        setMinutes(body.minutes);
        setDraftHtml(body.minutes.contentHtml);
        setEditMode(false);
        toast.success(t("minutesGeneratedSuccess"));
        router.refresh();
      }
    } catch {
      toast.error(t("minutesGenerateError"));
    } finally {
      setBusy(null);
    }
  };

  const saveHtml = async () => {
    if (!minutes || isFinalized) return;
    setBusy("save");
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/minutes?locale=${locale}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contentHtml: draftHtml }),
        },
      );
      const body = (await res.json()) as { minutes?: MinutesTabDto; error?: string };
      if (!res.ok) {
        toast.error(body.error ?? t("minutesSaveError"));
        return;
      }
      if (body.minutes) {
        setMinutes(body.minutes);
        setDraftHtml(body.minutes.contentHtml);
        setEditMode(false);
        markReviewSaved();
        toast.success(t("minutesSavedSuccess"));
      }
    } catch {
      toast.error(t("minutesSaveError"));
    } finally {
      setBusy(null);
    }
  };

  const finalize = async () => {
    if (!minutes || isFinalized) return;
    setBusy("finalize");
    try {
      const patchBody: { finalize: true; contentHtml?: string } = {
        finalize: true,
      };
      if (draftHtml !== minutes.contentHtml) {
        patchBody.contentHtml = draftHtml;
      }
      const res = await fetch(
        `/api/meetings/${meetingId}/minutes?locale=${locale}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        },
      );
      const body = (await res.json()) as { minutes?: MinutesTabDto; error?: string };
      if (!res.ok) {
        toast.error(body.error ?? t("minutesFinalizeError"));
        return;
      }
      if (body.minutes) {
        setMinutes(body.minutes);
        setDraftHtml(body.minutes.contentHtml);
        setEditMode(false);
        markReviewSaved();
        toast.success(t("minutesFinalizedSuccess"));
      }
    } catch {
      toast.error(t("minutesFinalizeError"));
    } finally {
      setBusy(null);
    }
  };

  const exportWord = async () => {
    if (!planLimits.canExportDocx) {
      showPlanUpgrade(tPlan("exportBlocked"));
      return;
    }
    setBusy("export");
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/minutes/export?locale=${locale}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as PlanLimitApiBody;
        if (res.status === 403 && err.upgradeRequired) {
          showPlanUpgradeFromApiBody(err, locale);
          return;
        }
        toast.error(err.error ?? t("minutesExportError"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `minutes-${meetingId.slice(0, 8)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t("minutesExportError"));
    } finally {
      setBusy(null);
    }
  };

  const submitSign = async () => {
    if (!planLimits.canSign) {
      showPlanUpgrade(tPlan("signBlocked"));
      return;
    }
    if (!signConfirm) {
      toast.error(t("minutesSignConfirmRequired"));
      return;
    }

    let body: { typedName: string | null; signatureImageUrl: string | null };
    if (signTab === "typed") {
      const name = signTyped.trim();
      if (!name) {
        toast.error(t("minutesSignNeedTyped"));
        return;
      }
      body = { typedName: name, signatureImageUrl: null };
    } else {
      const dataUrl = drawRef.current?.getPngDataUrl();
      if (!dataUrl) {
        toast.error(t("minutesSignNeedDraw"));
        return;
      }
      setBusy("sign");
      try {
        const blob = await (await fetch(dataUrl)).blob();
        const png = new File([blob], "signature.png", {
          type: blob.type || "image/png",
        });
        const up = await uploadFile(png, "/ccos/signatures");
        body = { typedName: null, signatureImageUrl: up.url };
      } catch (e) {
        console.error(e);
        toast.error(
          e instanceof Error ? e.message : t("minutesSignError"),
        );
        setBusy(null);
        return;
      }
    }

    setBusy("sign");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/minutes/sign`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const resBody = (await res.json().catch(() => ({}))) as PlanLimitApiBody & {
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 403 && resBody.upgradeRequired) {
          showPlanUpgradeFromApiBody(resBody, locale);
          return;
        }
        toast.error(resBody.error ?? t("minutesSignError"));
        return;
      }
      toast.success(t("minutesSignedSuccess"));
      setSignOpen(false);
      await loadMinutes();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : t("minutesSignError"),
      );
    } finally {
      setBusy(null);
    }
  };

  const confirmRemoveSignature = async () => {
    if (!removeTarget) return;
    setBusy("remove-sig");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/minutes/sign`, {
        method: "DELETE",
        credentials: "include",
      });
      const resBody = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(resBody.error ?? t("minutesRemoveSignatureError"));
        return;
      }
      toast.success(t("minutesRemoveSignatureSuccess"));
      setRemoveTarget(null);
      await loadMinutes();
    } catch {
      toast.error(t("minutesRemoveSignatureError"));
    } finally {
      setBusy(null);
    }
  };

  const onAdoptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const lower = f.name.toLowerCase();
    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      toast.error(t("minutesAdoptInvalidType"));
      return;
    }
    setAdoptPreview(f);
  };

  const submitAdopt = async () => {
    if (!adoptPreview) {
      toast.error(t("minutesAdoptPickFile"));
      return;
    }
    setBusy("adopt");
    try {
      const uploaded = await uploadFile(adoptPreview, "/ccos/minutes");
      const lower = adoptPreview.name.toLowerCase();
      const mime =
        uploaded.mime ||
        adoptPreview.type ||
        (lower.endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      const res = await fetch(`/api/meetings/${meetingId}/minutes/adopt`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: uploaded.url,
          name: uploaded.name,
          mime,
          size: uploaded.size,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? t("minutesAdoptError"));
        return;
      }
      toast.success(t("minutesOfficialAdoptedToast"));
      setAdoptOpen(false);
      setAdoptPreview(null);
      await loadMinutes();
    } catch (e) {
      console.error(e);
      toast.error(
        e instanceof Error ? e.message : t("minutesAdoptError"),
      );
    } finally {
      setBusy(null);
    }
  };

  const runNotifyAttendees = async () => {
    setBusy("notify");
    try {
      const res = await fetch(`/api/meetings/${meetingId}/minutes/notify`, {
        method: "POST",
        credentials: "include",
      });
      const body = (await res.json().catch(() => ({}))) as {
        notified?: number;
        error?: string;
      };
      if (!res.ok) {
        toast.error(body.error ?? t("minutesNotifyError"));
        return;
      }
      const n = typeof body.notified === "number" ? body.notified : 0;
      toast.success(t("minutesNotifySuccessWithCount", { count: n }));
      setNotifyOpen(false);
      await loadMinutes();
    } catch {
      toast.error(t("minutesNotifyError"));
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
        <Spinner className="size-4" />
        {tCommon("loading")}
      </div>
    );
  }

  if (!minutes) {
    const blockedLiveOrScheduled =
      meetingStatus === "SCHEDULED" || meetingStatus === "LIVE";
    return (
      <div className="space-y-4">
        <MinutesWorkflowStepper
          locale={locale}
          hasMinutesRow={false}
          reviewSaved={false}
          isFinalized={false}
          hasSignatures={false}
          isAdopted={false}
          attendeesNotified={false}
        />
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("minutesEmptyTitle")}</CardTitle>
            <CardDescription>{t("minutesEmptyDescription")}</CardDescription>
          </CardHeader>
        </Card>
        {blockedLiveOrScheduled && !canGenerate ? (
          <Alert>
            <AlertTitle>{t("minutesBlockedTitle")}</AlertTitle>
            <AlertDescription>{t("minutesBlockedLiveOrScheduled")}</AlertDescription>
          </Alert>
        ) : !canGenerate ? (
          <p className="text-muted-foreground text-sm">{t("minutesGenerateUnavailable")}</p>
        ) : null}
        {canGenerate ? (
          <Button
            type="button"
            onClick={() => void generate()}
            disabled={busy !== null}
            className="gap-2"
          >
            {busy === "generate" ? (
              <Spinner className="size-4" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {busy === "generate" ? tMin("generating") : tMin("generate")}
          </Button>
        ) : null}
        {canUseAiTranscriptDraft &&
        (meetingStatus === "LIVE" ||
          meetingStatus === "ENDED" ||
          meetingStatus === "ARCHIVED") ? (
          <LiveAiTranscriptDraftCard
            meetingId={meetingId}
            locale={locale}
            canUse
          />
        ) : null}
      </div>
    );
  }

  const docDir = locale === "ar" ? "rtl" : "ltr";

  const signDisabled =
    busy === "sign" ||
    !signConfirm ||
    (signTab === "typed" && !signTyped.trim()) ||
    (signTab === "draw" && !canvasHasInk);

  return (
    <div className="space-y-4">
      <MinutesWorkflowStepper
        locale={locale}
        hasMinutesRow
        reviewSaved={reviewSavedForStepper}
        isFinalized={isFinalized}
        hasSignatures={minutes.signatures.length > 0}
        isAdopted={isAdopted}
        attendeesNotified={attendeesNotified}
      />
      {canUseAiTranscriptDraft &&
      !isFinalized &&
      (meetingStatus === "LIVE" ||
        meetingStatus === "ENDED" ||
        meetingStatus === "ARCHIVED") ? (
        <LiveAiTranscriptDraftCard
          meetingId={meetingId}
          locale={locale}
          canUse
          onAppendHtml={(fragment) => {
            setDraftHtml((prev) => `${prev}${fragment}`);
            setEditMode(true);
          }}
          appendDisabled={busy !== null}
        />
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {isAdopted ? (
          <Badge variant="default">{t("minutesAdoptedBadge")}</Badge>
        ) : isFinalized ? (
          <Badge variant="secondary" className="gap-1">
            <Lock className="size-3" aria-hidden />
            {t("minutesFinalizedBadge")}
            {minutes.finalizedAt ? (
              <span className="text-muted-foreground ms-1 font-normal">
                · {formatDateTime(minutes.finalizedAt, locale)}
              </span>
            ) : null}
          </Badge>
        ) : (
          <Badge variant="outline">{t("minutesDraftBadge")}</Badge>
        )}
      </div>

      {isAdopted && minutes.adoptedDocumentUrl ? (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">{t("minutesOfficialDocument")}</CardTitle>
            <CardDescription>
              {minutes.adoptedByName
                ? t("minutesAdoptedBy", { name: minutes.adoptedByName })
                : null}
              {minutes.adoptedAt
                ? ` · ${formatDateTime(minutes.adoptedAt, locale)}`
                : null}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {minutes.adoptedDocumentMime?.includes("pdf") ? (
                <FileIcon className="text-muted-foreground size-8 shrink-0" aria-hidden />
              ) : (
                <FileText className="text-muted-foreground size-8 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium leading-tight">
                  {minutes.adoptedDocumentName ?? t("minutesAdoptedFileFallback")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {minutes.adoptedDocumentMime ?? "—"} ·{" "}
                  {formatFileSize(minutes.adoptedDocumentSize, locale)}
                </p>
              </div>
            </div>
            <a
              href={minutes.adoptedDocumentUrl}
              download={minutes.adoptedDocumentName ?? "minutes-document"}
              className="text-primary inline-flex text-sm font-medium underline-offset-4 hover:underline"
            >
              {t("minutesAdoptedDownload")}
            </a>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!isFinalized ? (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled
                    aria-disabled
                  >
                    <PenTool className="size-4" aria-hidden />
                    {t("minutesSignMinutes")}
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{t("minutesSignWhenNotFinalized")}</TooltipContent>
            </Tooltip>
            {!editMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                disabled={busy !== null}
                onClick={() => {
                  setDraftHtml(minutes.contentHtml);
                  setEditSession((s) => s + 1);
                  setEditMode(true);
                }}
              >
                <Pencil className="size-4" />
                {tMin("edit")}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  size="sm"
                  className="gap-2"
                  disabled={busy !== null}
                  onClick={() => void saveHtml()}
                >
                  {busy === "save" ? (
                    <Spinner className="size-4" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {tMin("save")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => {
                    setDraftHtml(minutes.contentHtml);
                    setEditMode(false);
                  }}
                >
                  {tCommon("cancel")}
                </Button>
              </>
            )}
            {perms.canFinalizeMinutes ? (
              <Button
                type="button"
                variant="default"
                size="sm"
                className="gap-2"
                disabled={busy !== null}
                onClick={() => void finalize()}
              >
                {busy === "finalize" ? (
                  <Spinner className="size-4" />
                ) : (
                  <Lock className="size-4" />
                )}
                {tMin("finalize")}
              </Button>
            ) : null}
          </>
        ) : null}

        <div className="relative inline-flex shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("gap-2", !planLimits.canExportDocx && "pe-10")}
            disabled={busy !== null}
            onClick={() => void exportWord()}
          >
            {busy === "export" ? (
              <Spinner className="size-4" />
            ) : (
              <FileDown className="size-4" />
            )}
            {tMin("export")}
          </Button>
          {!planLimits.canExportDocx ? (
            <span
              className={cn(
                "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-1",
                locale === "ar" ? "inset-s-2" : "inset-e-2",
              )}
              aria-hidden
            >
              <Lock className="size-3.5 opacity-60" />
              <Badge
                variant="secondary"
                className="px-1 py-0 text-[10px] leading-tight"
              >
                {tPlan("proBadge")}
              </Badge>
            </span>
          ) : null}
        </div>

        {isFinalized && !isAdopted ? (
          <>
            <div className="relative inline-flex shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("gap-2", !planLimits.canSign && "pe-10")}
                disabled={busy !== null}
                onClick={() => {
                  if (!planLimits.canSign) {
                    showPlanUpgrade(tPlan("signBlocked"));
                    return;
                  }
                  resetSignDialog();
                  setSignOpen(true);
                }}
              >
                <PenTool className="size-4" />
                {t("minutesSignMinutes")}
              </Button>
              {!planLimits.canSign ? (
                <span
                  className={cn(
                    "pointer-events-none absolute top-1/2 flex -translate-y-1/2 items-center gap-1",
                    locale === "ar" ? "inset-s-2" : "inset-e-2",
                  )}
                  aria-hidden
                >
                  <Lock className="size-3.5 opacity-60" />
                  <Badge
                    variant="secondary"
                    className="px-1 py-0 text-[10px] leading-tight"
                  >
                    {tPlan("proBadge")}
                  </Badge>
                </span>
              ) : null}
            </div>
            {perms.canFinalizeMinutes ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  disabled={busy !== null}
                  onClick={() => {
                    setAdoptPreview(null);
                    setAdoptOpen(true);
                  }}
                >
                  <Upload className="size-4" />
                  {tMin("adopt")}
                </Button>
                {minutes.attendeesNotifiedAt ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-2"
                    disabled
                  >
                    <Check className="size-4" aria-hidden />
                    {t("minutesNotifiedBadge")}
                    <span className="text-muted-foreground ms-1 text-xs font-normal">
                      {formatDateTime(minutes.attendeesNotifiedAt, locale)}
                    </span>
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    disabled={busy !== null}
                    onClick={() => setNotifyOpen(true)}
                  >
                    <Send className="size-4" />
                    {tMin("notifyAttendees")}
                  </Button>
                )}
              </>
            ) : null}
          </>
        ) : null}

        {isFinalized && isAdopted && perms.canFinalizeMinutes ? (
          minutes.attendeesNotifiedAt ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="gap-2"
              disabled
            >
              <Check className="size-4" aria-hidden />
              {t("minutesNotifiedBadge")}
              <span className="text-muted-foreground ms-1 text-xs font-normal">
                {formatDateTime(minutes.attendeesNotifiedAt, locale)}
              </span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={busy !== null}
              onClick={() => setNotifyOpen(true)}
            >
              <Send className="size-4" />
              {tMin("notifyAttendees")}
            </Button>
          )
        ) : null}
      </div>

      {editMode && !isFinalized ? (
        <div className="space-y-0">
          <MinutesHtmlEditorToolbar
            editorRef={editorRef}
            disabled={busy !== null}
          />
          <MinutesHtmlEditor
            key={editSession}
            ref={editorRef}
            initialHtml={minutes.contentHtml}
            dir={docDir}
            disabled={busy !== null}
            onHtmlChange={setDraftHtml}
          />
        </div>
      ) : (
        <div
          className={cn(
            "minutes-preview max-h-[70vh] overflow-auto rounded-md border bg-white p-4 shadow-sm",
            "dark:bg-card",
          )}
          dir={docDir}
          dangerouslySetInnerHTML={{ __html: minutes.contentHtml }}
        />
      )}

      {isFinalized ? (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold">{t("minutesSignaturesTitle")}</h3>
          {minutes.signatures.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              {t("minutesSignaturesEmpty")}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {minutes.signatures.map((s) => (
                <Card key={s.id} className="shadow-sm">
                  <CardHeader className="space-y-2 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 space-y-2">
                        <CardTitle className="text-base leading-tight">
                          {s.userName}
                        </CardTitle>
                        <Badge variant="secondary" className="font-normal">
                          {s.roleLabel}
                        </Badge>
                      </div>
                      {s.userId === currentUserId ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="text-muted-foreground hover:text-destructive size-8 shrink-0"
                          aria-label={t("minutesRemoveSignature")}
                          disabled={busy !== null}
                          onClick={() => setRemoveTarget(s)}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      ) : null}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3 pt-0">
                    {s.signatureImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.signatureImageUrl}
                        alt=""
                        className="max-h-28 max-w-full rounded border bg-white object-contain dark:bg-background"
                      />
                    ) : s.typedName ? (
                      <p
                        className="text-foreground text-2xl leading-snug"
                        style={{
                          fontFamily:
                            "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive",
                        }}
                      >
                        {s.typedName}
                      </p>
                    ) : (
                      <p className="text-muted-foreground text-sm">—</p>
                    )}
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(s.signedAt, locale)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      ) : null}

      <Button variant="outline" size="sm" className="w-full sm:w-auto" asChild>
        <Link href={`/meetings/${meetingId}/minutes`}>{t("openMinutesPage")}</Link>
      </Button>

      <Dialog
        open={signOpen}
        onOpenChange={(open) => {
          setSignOpen(open);
          if (!open) resetSignDialog();
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("minutesSignDialogTitle")}</DialogTitle>
          </DialogHeader>
          <Tabs
            value={signTab}
            onValueChange={(v) => {
              const next = v as "typed" | "draw";
              setSignTab(next);
              if (next === "draw") {
                setSignTyped("");
              } else {
                drawRef.current?.clear();
                setCanvasHasInk(false);
              }
            }}
            className="gap-3"
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="typed">{t("minutesSignTypedTab")}</TabsTrigger>
              <TabsTrigger value="draw">{t("minutesSignDrawTab")}</TabsTrigger>
            </TabsList>
            <TabsContent value="typed" className="space-y-3 pt-1">
              <div className="space-y-2">
                <Label htmlFor="sign-typed">{t("minutesSignTypedLabel")}</Label>
                <Input
                  id="sign-typed"
                  value={signTyped}
                  onChange={(e) => setSignTyped(e.target.value)}
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1">
                <Label>{t("minutesSignTypedPreview")}</Label>
                <div
                  className="border-input bg-muted/30 text-foreground min-h-[72px] rounded-md border px-3 py-3 text-2xl"
                  style={{
                    fontFamily:
                      "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive",
                  }}
                >
                  {signTyped.trim() ? signTyped : "—"}
                </div>
              </div>
            </TabsContent>
            <TabsContent value="draw" className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label>{t("minutesSignDrawLabel")}</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    drawRef.current?.clear();
                    setCanvasHasInk(false);
                  }}
                >
                  {t("minutesSignDrawClear")}
                </Button>
              </div>
              <SignatureDrawCanvas
                ref={drawRef}
                className="border-input w-full max-w-full rounded-md border bg-white"
                width={480}
                height={180}
                onInkChange={setCanvasHasInk}
              />
            </TabsContent>
          </Tabs>
          <div className="flex items-start gap-2 pt-1">
            <Checkbox
              id="sign-confirm"
              checked={signConfirm}
              onCheckedChange={(c) => setSignConfirm(c === true)}
            />
            <Label htmlFor="sign-confirm" className="text-sm leading-snug font-normal">
              {t("minutesSignConfirmCheckbox")}
            </Label>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setSignOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={signDisabled}
              onClick={() => void submitSign()}
            >
              {busy === "sign" ? <Spinner className="size-4" /> : null}
              {tMin("sign")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={removeTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("minutesRemoveSignatureTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("minutesRemoveSignatureDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "remove-sig"}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={busy === "remove-sig"}
              onClick={(e) => {
                e.preventDefault();
                void confirmRemoveSignature();
              }}
            >
              {busy === "remove-sig" ? <Spinner className="size-4" /> : null}
              {t("minutesRemoveSignature")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={notifyOpen} onOpenChange={setNotifyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("minutesNotifyConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("minutesNotifyConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "notify"}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "notify"}
              onClick={(e) => {
                e.preventDefault();
                void runNotifyAttendees();
              }}
            >
              {busy === "notify" ? <Spinner className="size-4" /> : null}
              {t("minutesNotifyConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={adoptOpen}
        onOpenChange={(open) => {
          setAdoptOpen(open);
          if (!open) setAdoptPreview(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("minutesAdoptDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="adopt-file">{t("minutesAdoptPickFile")}</Label>
              <Input
                id="adopt-file"
                type="file"
                accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                disabled={busy === "adopt"}
                onChange={onAdoptFileChange}
              />
            </div>
            {busy === "adopt" ? (
              <div className="space-y-2">
                <p className="text-muted-foreground text-xs">{tMin("adoptUploading")}</p>
                <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
                  <div className="bg-primary h-full w-1/3 animate-pulse rounded-full" />
                </div>
              </div>
            ) : null}
            {adoptPreview ? (
              <div className="bg-muted/50 space-y-1 rounded-md border p-3 text-sm">
                <p className="font-medium">{adoptPreview.name}</p>
                <p className="text-muted-foreground text-xs">
                  {adoptPreview.type || "—"} ·{" "}
                  {formatFileSize(adoptPreview.size, locale)}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-sm">{t("minutesAdoptNoPreview")}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setAdoptOpen(false);
                setAdoptPreview(null);
              }}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              disabled={busy === "adopt" || !adoptPreview}
              onClick={() => void submitAdopt()}
            >
              {busy === "adopt" ? <Spinner className="size-4" /> : null}
              {tMin("adopt")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
