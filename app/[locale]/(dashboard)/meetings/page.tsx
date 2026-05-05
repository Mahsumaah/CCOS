"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";

import { usePermissions } from "@/lib/permissions-context";
import { Archive, Calendar, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { MeetingCard, type MeetingForCard } from "@/components/meetings/MeetingCard";
import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, usePathname, useRouter } from "@/lib/i18n/routing";

type TabValue = "upcoming" | "past";

function MeetingsListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className="shadow-sm">
          <CardContent className="space-y-3 p-6">
            <Skeleton className="h-5 w-4/5" />
            <Skeleton className="h-4 w-3/5" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function MeetingsListInner() {
  const t = useTranslations("meetings");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale() as "ar" | "en";
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const perms = usePermissions();

  const tabFromUrl = useMemo<TabValue>(() => {
    return searchParams.get("tab") === "past" ? "past" : "upcoming";
  }, [searchParams]);

  const urlQ = (searchParams.get("q") ?? "").trim();

  const [searchInput, setSearchInput] = useState(() => searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = useState(urlQ);

  useEffect(() => {
    const q = searchParams.get("q") ?? "";
    setSearchInput(q);
    setDebouncedQ(q.trim());
  }, [tabFromUrl]);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebouncedQ(searchInput.trim());
    }, 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  useEffect(() => {
    const curTab = searchParams.get("tab") === "past" ? "past" : "upcoming";
    const curQ = (searchParams.get("q") ?? "").trim();
    if (curTab === tabFromUrl && curQ === debouncedQ) return;
    const p = new URLSearchParams();
    p.set("tab", tabFromUrl);
    if (debouncedQ) p.set("q", debouncedQ);
    router.replace(`${pathname}?${p.toString()}`);
  }, [debouncedQ, pathname, router, searchParams, tabFromUrl]);

  const [meetings, setMeetings] = useState<MeetingForCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === "loading") return;

    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set("tab", tabFromUrl);
    if (debouncedQ) params.set("q", debouncedQ);

    setLoading(true);
    setError(null);

    fetch(`/api/meetings?${params.toString()}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          if (res.status === 401) {
            setError("unauthorized");
            return;
          }
          throw new Error(String(res.status));
        }
        const data = (await res.json()) as MeetingForCard[];
        setMeetings(data);
      })
      .catch((e) => {
        if (e?.name === "AbortError") return;
        console.error(e);
        setError("failed");
        toast.error(tCommon("errorOccurred"));
      })
      .finally(() => {
        setLoading(false);
      });

    return () => controller.abort();
  }, [debouncedQ, sessionStatus, tabFromUrl, tCommon]);

  const canCreateMeetings = perms.canCreateMeetings;

  const onTabChange = (value: string) => {
    const nextTab = value === "past" ? "past" : "upcoming";
    const p = new URLSearchParams();
    p.set("tab", nextTab);
    const qTrim = searchInput.trim();
    if (qTrim) p.set("q", qTrim);
    router.replace(`${pathname}?${p.toString()}`);
  };

  const emptyMessage =
    tabFromUrl === "upcoming" ? t("emptyUpcomingList") : t("emptyPastList");

  return (
    <div className="flex flex-col gap-6">
      <DashboardBreadcrumbs
        items={[
          { href: "/dashboard", label: tNav("dashboard") },
          { label: t("title") },
        ]}
      />

      <div className="flex w-full flex-row flex-wrap items-center justify-between gap-4">
        <h1 className="min-w-0 shrink text-2xl font-semibold tracking-tight text-foreground">
          {t("title")}
        </h1>
        {canCreateMeetings ? (
          <Button variant="default" asChild className="shrink-0">
            <Link
              href="/meetings/new"
              locale={locale}
              className="bg-primary inline-flex items-center gap-2 font-semibold text-primary-foreground shadow-sm hover:bg-primary/90"
            >
              <Plus className="size-4 shrink-0" aria-hidden />
              {t("newMeeting")}
            </Link>
          </Button>
        ) : null}
      </div>

      <Tabs value={tabFromUrl} onValueChange={onTabChange} className="gap-4">
        <TabsList className="h-auto w-full max-w-full flex-nowrap justify-start overflow-x-auto">
          <TabsTrigger value="upcoming">{t("upcoming")}</TabsTrigger>
          <TabsTrigger value="past">{t("past")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="relative w-full max-w-md">
        <Search className="text-muted-foreground pointer-events-none absolute inset-s-3 top-1/2 size-4 -translate-y-1/2" />
        <Input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="w-full ps-9"
          aria-label={t("searchPlaceholder")}
        />
      </div>

      {loading ? (
        <MeetingsListSkeleton />
      ) : error ? (
        <p className="text-destructive text-sm">{t("loadError")}</p>
      ) : meetings.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            {tabFromUrl === "upcoming" ? (
              <Calendar className="text-muted-foreground size-10" aria-hidden />
            ) : (
              <Archive className="text-muted-foreground size-10" aria-hidden />
            )}
            <p className="text-muted-foreground text-sm">{emptyMessage}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} meeting={m} locale={locale} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function MeetingsPage() {
  return (
    <Suspense fallback={<MeetingsListSkeleton />}>
      <MeetingsListInner />
    </Suspense>
  );
}
