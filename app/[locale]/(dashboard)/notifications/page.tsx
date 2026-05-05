"use client";

import * as React from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { formatRelativeTime } from "@/lib/format";
import { getNotificationConfig } from "@/lib/notification-types";
import { useRouter } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  type: string;
  payload: unknown;
  readAt: string | null;
  createdAt: string;
  meetingId: string | null;
  meeting: { id: string; title: string } | null;
};

function payloadRecord(p: unknown): Record<string, unknown> {
  return p && typeof p === "object" && !Array.isArray(p)
    ? (p as Record<string, unknown>)
    : {};
}

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();

  const [items, setItems] = React.useState<NotificationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [markAllBusy, setMarkAllBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    const res = await fetch("/api/notifications", { credentials: "include" });
    if (!res.ok) {
      toast.error(tCommon("errorOccurred"));
      setLoading(false);
      return;
    }
    const data = (await res.json()) as { notifications?: NotificationRow[] };
    setItems(data.notifications ?? []);
    setLoading(false);
  }, [tCommon]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}`, {
      method: "PATCH",
      credentials: "include",
    });
  }

  async function onRowActivate(n: NotificationRow) {
    if (!n.readAt) {
      await markRead(n.id);
      setItems((prev) =>
        prev.map((x) =>
          x.id === n.id
            ? { ...x, readAt: new Date().toISOString() }
            : x,
        ),
      );
    }
    if (n.meetingId) {
      router.push(`/meetings/${n.meetingId}`);
    }
  }

  async function onDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const res = await fetch(`/api/notifications/${id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (!res.ok) {
      toast.error(tCommon("errorOccurred"));
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== id));
    toast.success(t("deletedToast"));
  }

  async function onMarkAllRead() {
    setMarkAllBusy(true);
    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error(tCommon("errorOccurred"));
        return;
      }
      const now = new Date().toISOString();
      setItems((prev) => prev.map((x) => ({ ...x, readAt: x.readAt ?? now })));
      toast.success(t("markAllReadToast"));
    } finally {
      setMarkAllBusy(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          onClick={() => void onMarkAllRead()}
          disabled={loading || markAllBusy || !items.some((x) => !x.readAt)}
        >
          {markAllBusy ? (
            <Spinner className="me-2 size-4" />
          ) : (
            <CheckCheck className="me-2 size-4" />
          )}
          {t("markAllRead")}
        </Button>
      </div>

      {loading ? (
        <ul className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <li
              key={i}
              className="flex gap-3 rounded-lg border border-border p-4"
            >
              <Skeleton className="size-10 shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="h-4 w-full max-w-xs" />
                <Skeleton className="h-3 w-full max-w-md" />
              </div>
              <Skeleton className="size-9 shrink-0 rounded-md" />
            </li>
          ))}
        </ul>
      ) : items.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed py-16">
          <Bell className="size-10 opacity-40" aria-hidden />
          <p className="text-sm">{t("noNotifications")}</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((n) => {
            const { label, Icon } = getNotificationConfig(n.type, locale);
            const pl = payloadRecord(n.payload);
            const meetingTitle =
              (typeof pl.meetingTitle === "string" ? pl.meetingTitle : null) ??
              n.meeting?.title ??
              null;
            const detail =
              typeof pl.question === "string"
                ? pl.question
                : typeof pl.preview === "string"
                  ? pl.preview
                  : typeof pl.signerName === "string"
                    ? pl.signerName
                    : null;
            const unread = !n.readAt;

            return (
              <li key={n.id}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => void onRowActivate(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      void onRowActivate(n);
                    }
                  }}
                  className={cn(
                    "flex w-full cursor-pointer gap-3 rounded-lg border p-4 text-start transition-colors",
                    "hover:bg-muted/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none",
                    unread
                      ? "border border-border bg-background border-s-4 border-s-primary shadow-sm"
                      : "border border-border bg-muted/50",
                  )}
                >
                  <div
                    className={cn(
                      "flex size-10 shrink-0 items-center justify-center rounded-full",
                      unread ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                    )}
                  >
                    <Icon className="size-5" aria-hidden />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">{label}</Badge>
                      <span className="text-muted-foreground text-xs">
                        {formatRelativeTime(n.createdAt, locale)}
                      </span>
                    </div>
                    {meetingTitle ? (
                      <p className="truncate text-sm font-medium">{meetingTitle}</p>
                    ) : null}
                    {detail ? (
                      <p className="text-muted-foreground line-clamp-2 text-sm">{detail}</p>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-9 shrink-0"
                    aria-label={t("delete")}
                    onClick={(e) => void onDelete(n.id, e)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
