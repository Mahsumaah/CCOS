"use client";

import { File, FileDown, FileText, Printer } from "lucide-react";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDateTime, formatFileSize } from "@/lib/format";
import { cn } from "@/lib/utils";

export type StandaloneSignature = {
  id: string;
  userName: string;
  roleLabel: string;
  signedAt: string;
  typedName: string | null;
  signatureImageUrl: string | null;
};

export type MeetingMinutesDocumentViewProps = {
  meetingId: string;
  meetingTitle: string;
  locale: "ar" | "en";
  contentHtml: string;
  adopted: {
    url: string | null;
    name: string | null;
    mime: string | null;
    size: number | null;
    adoptedAt: string | null;
    adoptedByName: string | null;
  } | null;
  signatures: StandaloneSignature[];
};

export function MeetingMinutesDocumentView({
  meetingId,
  meetingTitle,
  locale,
  contentHtml,
  adopted,
  signatures,
}: MeetingMinutesDocumentViewProps) {
  const tNav = useTranslations("nav");
  const tMeetings = useTranslations("meetings");
  const tMin = useTranslations("minutes");
  const tCommon = useTranslations("common");
  const [exportBusy, setExportBusy] = useState(false);
  const docDir = locale === "ar" ? "rtl" : "ltr";

  const exportWord = async () => {
    setExportBusy(true);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/minutes/export?locale=${locale}`,
        { credentials: "include" },
      );
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? tMeetings("minutesExportError"));
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
      toast.error(tCommon("errorOccurred"));
    } finally {
      setExportBusy(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
      <div className="no-print">
        <DashboardBreadcrumbs
          items={[
            { href: "/dashboard", label: tNav("dashboard") },
            { href: "/meetings", label: tNav("meetings") },
            { href: `/meetings/${meetingId}`, label: meetingTitle },
            { label: tMeetings("breadcrumbMinutes") },
          ]}
        />
      </div>

      <div className="no-print flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          disabled={exportBusy}
          onClick={() => void exportWord()}
        >
          {exportBusy ? <Spinner className="size-4" /> : <FileDown className="size-4" />}
          {tMin("export")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => window.print()}
        >
          <Printer className="size-4" />
          {tMeetings("minutesPrint")}
        </Button>
      </div>

      {adopted?.url ? (
        <Card className="no-print shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">
              {tMeetings("minutesOfficialDocument")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              {adopted.mime?.includes("pdf") ? (
                <File className="text-muted-foreground size-8 shrink-0" aria-hidden />
              ) : (
                <FileText className="text-muted-foreground size-8 shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1 space-y-1">
                <p className="font-medium leading-tight">
                  {adopted.name ?? tMeetings("minutesAdoptedFileFallback")}
                </p>
                <p className="text-muted-foreground text-xs">
                  {adopted.mime ?? "—"} ·{" "}
                  {formatFileSize(adopted.size, locale)}
                </p>
                {adopted.adoptedByName && adopted.adoptedAt ? (
                  <p className="text-muted-foreground text-xs">
                    {tMeetings("minutesAdoptedBy", { name: adopted.adoptedByName })} ·{" "}
                    {formatDateTime(adopted.adoptedAt, locale)}
                  </p>
                ) : null}
              </div>
            </div>
            <a
              href={adopted.url}
              download={adopted.name ?? "minutes-document"}
              className="text-primary text-sm font-medium underline-offset-4 hover:underline"
            >
              {tMeetings("minutesAdoptedDownload")}
            </a>
          </CardContent>
        </Card>
      ) : null}

      <div className="minutes-document-print space-y-6">
        <div
          className={cn(
            "minutes-document minutes-preview rounded-md border bg-white p-6 shadow-sm",
            "dark:bg-card",
          )}
          dir={docDir}
          dangerouslySetInnerHTML={{ __html: contentHtml }}
        />

        {signatures.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{tMeetings("minutesSignaturesTitle")}</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {signatures.map((s) => (
                <Card key={s.id} className="shadow-sm">
                  <CardHeader className="space-y-2 pb-2">
                    <CardTitle className="text-base leading-tight">{s.userName}</CardTitle>
                    <Badge variant="secondary" className="w-fit font-normal">
                      {s.roleLabel}
                    </Badge>
                  </CardHeader>
                  <CardContent className="space-y-2 pt-0">
                    {s.signatureImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- data URL signatures
                      <img
                        src={s.signatureImageUrl}
                        alt=""
                        className="max-h-28 max-w-full rounded border bg-white object-contain"
                      />
                    ) : s.typedName ? (
                      <p
                        className="text-foreground text-2xl"
                        style={{
                          fontFamily:
                            "'Segoe Script', 'Brush Script MT', 'Snell Roundhand', cursive",
                        }}
                      >
                        {s.typedName}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {formatDateTime(s.signedAt, locale)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  );
}
