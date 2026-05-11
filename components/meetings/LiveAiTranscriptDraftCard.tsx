"use client";

import { Bot, ClipboardCopy, Loader2, Sparkles } from "lucide-react";
import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { plainTextOrMarkdownToMinutesHtmlFragment } from "@/lib/markdown-to-minutes-html";

type LiveAiTranscriptDraftCardProps = {
  meetingId: string;
  locale: "ar" | "en";
  /** When set, transcript list / draft is scoped to this live session. */
  liveSessionId?: string | null;
  canUse: boolean;
  /** When provided, show "Append to minutes" for generated HTML fragment. */
  onAppendHtml?: (html: string) => void;
  appendDisabled?: boolean;
};

export function LiveAiTranscriptDraftCard({
  meetingId,
  locale,
  liveSessionId,
  canUse,
  onAppendHtml,
  appendDisabled,
}: LiveAiTranscriptDraftCardProps) {
  const t = useTranslations("meetings.aiTranscriptDraft");
  const tCommon = useTranslations("common");
  const [segmentCount, setSegmentCount] = useState<number | null>(null);
  const [loadingCount, setLoadingCount] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [markdown, setMarkdown] = useState("");
  const [truncated, setTruncated] = useState(false);
  const [modelLabel, setModelLabel] = useState<string | null>(null);

  const refreshCount = useCallback(async () => {
    if (!canUse) return;
    setLoadingCount(true);
    try {
      const q = new URLSearchParams();
      if (liveSessionId) q.set("liveSessionId", liveSessionId);
      const res = await fetch(
        `/api/meetings/${meetingId}/live/transcript?${q.toString()}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        setSegmentCount(null);
        return;
      }
      const data = (await res.json()) as { count?: number };
      setSegmentCount(typeof data.count === "number" ? data.count : 0);
    } catch {
      setSegmentCount(null);
    } finally {
      setLoadingCount(false);
    }
  }, [canUse, meetingId, liveSessionId]);

  const openPrepare = async () => {
    setDialogOpen(true);
    setMarkdown("");
    setTruncated(false);
    setModelLabel(null);
    await refreshCount();
  };

  const runDraft = async () => {
    setGenerating(true);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/live/ai/draft-minutes?locale=${locale}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            liveSessionId: liveSessionId ?? null,
          }),
        },
      );
      const body = (await res.json().catch(() => ({}))) as {
        markdown?: string;
        model?: string;
        truncated?: boolean;
        error?: string;
        message?: string;
      };

      if (res.status === 503 && body.error === "openrouter_not_configured") {
        toast.error(t("notConfigured"));
        return;
      }
      if (res.status === 400 && body.error === "no_transcript_segments") {
        toast.error(t("noTranscript"));
        return;
      }
      if (res.status === 429 && body.error === "rate_limited") {
        toast.error(t("rateLimited"));
        return;
      }
      if (!res.ok) {
        toast.error(t("generateError"));
        return;
      }
      if (body.markdown) {
        setMarkdown(body.markdown);
        setTruncated(Boolean(body.truncated));
        setModelLabel(body.model ?? null);
        toast.success(t("generateSuccess"));
      }
    } catch {
      toast.error(t("generateError"));
    } finally {
      setGenerating(false);
    }
  };

  const copyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      toast.success(t("copied"));
    } catch {
      toast.error(tCommon("errorOccurred"));
    }
  };

  const appendToMinutes = () => {
    if (!onAppendHtml || !markdown.trim()) return;
    const html = plainTextOrMarkdownToMinutesHtmlFragment(markdown);
    onAppendHtml(html);
    toast.success(t("appended"));
    setDialogOpen(false);
  };

  if (!canUse) {
    return null;
  }

  return (
    <>
      <Card className="shadow-sm">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" aria-hidden />
            <CardTitle>{t("title")}</CardTitle>
          </div>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Alert>
            <Bot className="size-4" aria-hidden />
            <AlertTitle>{t("disclaimerTitle")}</AlertTitle>
            <AlertDescription>{t("disclaimerBody")}</AlertDescription>
          </Alert>
          <Button type="button" variant="secondary" size="sm" onClick={() => void openPrepare()}>
            {t("openDialog")}
          </Button>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>{t("dialogDescription")}</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {loadingCount ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {tCommon("loading")}
                </span>
              ) : segmentCount != null ? (
                t("segmentCount", { count: segmentCount })
              ) : (
                t("segmentCountUnknown")
              )}
            </p>
            {truncated && markdown ? (
              <p className="text-muted-foreground text-xs">{t("truncatedHint")}</p>
            ) : null}
            {modelLabel ? (
              <p className="text-muted-foreground text-xs">
                {t("modelLabel", { model: modelLabel })}
              </p>
            ) : null}
          </div>

          {markdown ? (
            <pre className="bg-muted max-h-[40vh] overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap">
              {markdown}
            </pre>
          ) : null}

          <DialogFooter className="flex flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            {markdown ? (
              <>
                <Button type="button" variant="outline" onClick={() => void copyMarkdown()}>
                  <ClipboardCopy className="me-2 size-4" aria-hidden />
                  {t("copyMarkdown")}
                </Button>
                {onAppendHtml ? (
                  <Button
                    type="button"
                    disabled={appendDisabled}
                    onClick={() => appendToMinutes()}
                  >
                    {t("appendToMinutes")}
                  </Button>
                ) : null}
              </>
            ) : null}
            <Button type="button" disabled={generating} onClick={() => void runDraft()}>
              {generating ? <Loader2 className="me-2 size-4 animate-spin" aria-hidden /> : null}
              {markdown ? t("regenerate") : t("generate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
