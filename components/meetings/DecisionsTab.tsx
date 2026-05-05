"use client";

import type { DecisionStatus } from "@prisma/client";
import { format } from "date-fns";
import { ar as arLocale, enUS } from "date-fns/locale";
import {
  CalendarIcon,
  Check,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Calendar } from "@/components/ui/calendar";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, formatDateTime, formatRelativeTime } from "@/lib/format";
import { usePermissions } from "@/lib/permissions-context";
import { cn } from "@/lib/utils";

export type DecisionDTO = {
  id: string;
  textAr: string;
  textEn: string | null;
  status: DecisionStatus;
  agendaItemId: string | null;
  agendaItem: {
    id: string;
    titleAr: string;
    titleEn: string | null;
  } | null;
  ownerId: string | null;
  owner: { id: string; name: string } | null;
  dueDate: string | null;
  createdBy: { id: string; name: string };
  createdById: string;
  createdAt: string;
  approvedById: string | null;
  approvedBy: { id: string; name: string } | null;
  approvedAt: string | null;
};

type AgendaItemOption = {
  id: string;
  titleAr: string;
  titleEn: string | null;
};

function statusBadgeClass(status: DecisionStatus): string {
  switch (status) {
    case "OPEN":
      return "bg-blue-600 text-white hover:bg-blue-600/90";
    case "IN_PROGRESS":
      return "bg-amber-500 text-amber-950 hover:bg-amber-500/90";
    case "DONE":
      return "bg-emerald-600 text-white hover:bg-emerald-600/90";
    case "CANCELLED":
      return "bg-red-600 text-white hover:bg-red-600/90";
    default:
      return "";
  }
}

const STATUSES: DecisionStatus[] = [
  "OPEN",
  "IN_PROGRESS",
  "DONE",
  "CANCELLED",
];

export function DecisionsTab({
  meetingId,
  agendaItems,
  invitees,
  currentUserId: _currentUserId,
  locale,
  createPrefill,
  onConsumeCreatePrefill,
}: {
  meetingId: string;
  agendaItems: AgendaItemOption[];
  invitees: { id: string; name: string }[];
  currentUserId: string;
  locale: "ar" | "en";
  createPrefill?: {
    key: number;
    textAr: string;
    agendaItemId: string | null;
  } | null;
  onConsumeCreatePrefill?: () => void;
}) {
  void _currentUserId; // reserved for future attribution rules
  const perms = usePermissions();
  const t = useTranslations("decisions");
  const tCommon = useTranslations("common");
  const dateFnsLocale = locale === "ar" ? arLocale : enUS;
  const appliedPrefillKey = useRef<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [decisions, setDecisions] = useState<DecisionDTO[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cTextAr, setCTextAr] = useState("");
  const [cTextEn, setCTextEn] = useState("");
  const [cAgendaId, setCAgendaId] = useState("");
  const [cOwnerId, setCOwnerId] = useState("");
  const [cDue, setCDue] = useState<Date | undefined>(undefined);

  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<DecisionDTO | null>(null);
  const [eTextAr, setETextAr] = useState("");
  const [eTextEn, setETextEn] = useState("");
  const [eOwnerId, setEOwnerId] = useState("");
  const [eAgendaId, setEAgendaId] = useState("");
  const [eDue, setEDue] = useState<Date | undefined>(undefined);
  const [eStatus, setEStatus] = useState<DecisionStatus>("OPEN");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<DecisionDTO | null>(null);
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null);

  const fetchDecisions = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/decisions`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { decisions: DecisionDTO[] };
      setDecisions(data.decisions ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void fetchDecisions();
  }, [fetchDecisions]);

  useEffect(() => {
    if (!createPrefill) {
      appliedPrefillKey.current = null;
      return;
    }
    if (appliedPrefillKey.current === createPrefill.key) return;
    appliedPrefillKey.current = createPrefill.key;
    setCTextAr(createPrefill.textAr);
    setCTextEn("");
    setCAgendaId(createPrefill.agendaItemId ?? "");
    setCOwnerId("");
    setCDue(undefined);
    setCreateOpen(true);
    onConsumeCreatePrefill?.();
  }, [createPrefill, onConsumeCreatePrefill]);

  const agendaLabel = useMemo(
    () => (item: AgendaItemOption) =>
      locale === "en" && item.titleEn?.trim()
        ? item.titleEn
        : item.titleAr,
    [locale],
  );

  const agendaTitleFromDecision = (d: DecisionDTO) => {
    if (!d.agendaItem) return null;
    return locale === "en" && d.agendaItem.titleEn?.trim()
      ? d.agendaItem.titleEn
      : d.agendaItem.titleAr;
  };

  const statusLabel = (s: DecisionStatus) => {
    switch (s) {
      case "OPEN":
        return t("open");
      case "IN_PROGRESS":
        return t("inProgress");
      case "DONE":
        return t("done");
      case "CANCELLED":
        return t("cancelled");
      default:
        return s;
    }
  };

  const openCreate = () => {
    setCTextAr("");
    setCTextEn("");
    setCAgendaId("");
    setCOwnerId("");
    setCDue(undefined);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!cTextAr.trim()) {
      toast.error(t("textArRequired"));
      return;
    }
    setCreating(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/decisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          textAr: cTextAr.trim(),
          textEn: cTextEn.trim() || null,
          agendaItemId: cAgendaId || null,
          ownerId: cOwnerId || null,
          dueDate: cDue ? cDue.toISOString() : undefined,
        }),
      });
      if (!res.ok) {
        toast.error(t("createError"));
        return;
      }
      toast.success(t("decisionAdded"));
      setCreateOpen(false);
      await fetchDecisions();
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (d: DecisionDTO) => {
    setEditing(d);
    setETextAr(d.textAr);
    setETextEn(d.textEn ?? "");
    setEOwnerId(d.ownerId ?? "");
    setEAgendaId(d.agendaItemId ?? "");
    setEDue(d.dueDate ? new Date(d.dueDate) : undefined);
    setEStatus(d.status);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editing) return;
    if (!eTextAr.trim()) {
      toast.error(t("textArRequired"));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/decisions/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          textAr: eTextAr.trim(),
          textEn: eTextEn.trim() || null,
          ownerId: eOwnerId || null,
          agendaItemId: eAgendaId || null,
          dueDate: eDue ? eDue.toISOString() : null,
          status: eStatus,
        }),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("decisionUpdated"));
      setEditOpen(false);
      setEditing(null);
      await fetchDecisions();
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (id: string, status: DecisionStatus) => {
    setStatusBusyId(id);
    try {
      const res = await fetch(`/api/decisions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        toast.error(t("statusError"));
        return;
      }
      await fetchDecisions();
    } finally {
      setStatusBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setSaving(true);
    try {
      const res = await fetch(`/api/decisions/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        toast.error(t("deleteError"));
        return;
      }
      toast.success(t("decisionDeleted"));
      setDeleteTarget(null);
      await fetchDecisions();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <section className="space-y-4">
        {perms.canCreateDecisions ? (
          <div className="flex justify-end">
            <Skeleton className="h-9 w-40" />
          </div>
        ) : null}
        <div className="space-y-4">
          {[0, 1].map((i) => (
            <Card key={i}>
              <CardHeader className="space-y-3 pb-2">
                <div className="flex gap-2">
                  <Skeleton className="h-6 w-20 rounded-full" />
                  <Skeleton className="h-8 w-28 rounded-md" />
                </div>
                <Skeleton className="h-5 w-[90%]" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-52" />
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {perms.canCreateDecisions ? (
        <div className="flex justify-end">
          <Button type="button" onClick={openCreate}>
            {t("createDecision")}
          </Button>
        </div>
      ) : null}

      {decisions.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("emptyDecisions")}</p>
      ) : (
        <ul className="space-y-4">
          {decisions.map((d) => (
            <li key={d.id}>
              <Card>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className={cn(statusBadgeClass(d.status))}
                      >
                        {statusLabel(d.status)}
                      </Badge>
                      {perms.canEditDecisions ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              disabled={statusBusyId === d.id}
                            >
                              <MoreHorizontal className="size-4" />
                              {t("changeStatus")}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {STATUSES.map((s) => (
                              <DropdownMenuItem
                                key={s}
                                disabled={d.status === s}
                                onClick={() => void patchStatus(d.id, s)}
                              >
                                {s === "OPEN"
                                  ? t("markAsOpen")
                                  : s === "IN_PROGRESS"
                                    ? t("markAsInProgress")
                                    : s === "DONE"
                                      ? t("markAsDone")
                                      : t("markAsCancelled")}
                              </DropdownMenuItem>
                            ))}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : null}
                    </div>
                    <CardTitle className="text-base font-semibold leading-snug whitespace-pre-wrap">
                      {d.textAr}
                    </CardTitle>
                    {d.textEn?.trim() ? (
                      <p className="text-muted-foreground text-sm whitespace-pre-wrap">
                        {d.textEn}
                      </p>
                    ) : null}
                    {agendaTitleFromDecision(d) ? (
                      <p className="text-muted-foreground text-sm">
                        {agendaTitleFromDecision(d)}
                      </p>
                    ) : null}
                    {d.owner ? (
                      <p className="text-muted-foreground text-xs">
                        {t("owner")}: {d.owner.name}
                      </p>
                    ) : null}
                    {d.dueDate ? (
                      <p className="text-muted-foreground text-xs">
                        {t("dueDate")}: {formatDate(d.dueDate, locale)}
                      </p>
                    ) : null}
                    <p className="text-muted-foreground text-xs">
                      {d.createdBy.name} · {formatDateTime(d.createdAt, locale)} (
                      {formatRelativeTime(d.createdAt, locale)})
                    </p>
                    {d.approvedBy && d.approvedAt ? (
                      <p className="flex flex-wrap items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                        <Check className="size-4 shrink-0" aria-hidden />
                        <span>
                          {t("approvedBy", { name: d.approvedBy.name })} ·{" "}
                          {formatDateTime(d.approvedAt, locale)}
                        </span>
                      </p>
                    ) : null}
                  </div>
                  {perms.canEditDecisions ? (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="size-8"
                        aria-label={tCommon("edit")}
                        onClick={() => openEdit(d)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="text-destructive size-8"
                        aria-label={tCommon("delete")}
                        onClick={() => setDeleteTarget(d)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ) : null}
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("createDecision")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="d-text-ar">{t("textAr")} *</Label>
              <Textarea
                id="d-text-ar"
                value={cTextAr}
                onChange={(e) => setCTextAr(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="d-text-en">{t("textEn")}</Label>
              <Textarea
                id="d-text-en"
                value={cTextEn}
                onChange={(e) => setCTextEn(e.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("linkAgenda")}</Label>
              <Select
                value={cAgendaId || "__none__"}
                onValueChange={(v) => setCAgendaId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("linkAgendaOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("linkAgendaNone")}</SelectItem>
                  {agendaItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {agendaLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("owner")}</Label>
              <Select
                value={cOwnerId || "__none__"}
                onValueChange={(v) => setCOwnerId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("ownerOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("ownerNone")}</SelectItem>
                  {invitees.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("dueDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {cDue
                      ? format(cDue, "PPP", { locale: dateFnsLocale })
                      : t("pickDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={cDue}
                    onSelect={setCDue}
                    locale={dateFnsLocale}
                  />
                  {cDue ? (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setCDue(undefined)}
                      >
                        {t("clearDate")}
                      </Button>
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>
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
              {creating ? <Spinner className="size-4" /> : t("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{t("editDecision")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-1 flex-col gap-4 py-6">
            <div className="space-y-2">
              <Label htmlFor="e-text-ar">{t("textAr")} *</Label>
              <Textarea
                id="e-text-ar"
                value={eTextAr}
                onChange={(e) => setETextAr(e.target.value)}
                rows={5}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="e-text-en">{t("textEn")}</Label>
              <Textarea
                id="e-text-en"
                value={eTextEn}
                onChange={(e) => setETextEn(e.target.value)}
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("status")}</Label>
              <Select
                value={eStatus}
                onValueChange={(v) => setEStatus(v as DecisionStatus)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("linkAgenda")}</Label>
              <Select
                value={eAgendaId || "__none__"}
                onValueChange={(v) => setEAgendaId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("linkAgendaOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("linkAgendaNone")}</SelectItem>
                  {agendaItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {agendaLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("owner")}</Label>
              <Select
                value={eOwnerId || "__none__"}
                onValueChange={(v) => setEOwnerId(v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("ownerOptional")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("ownerNone")}</SelectItem>
                  {invitees.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("dueDate")}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full justify-start font-normal"
                  >
                    <CalendarIcon className="mr-2 size-4" />
                    {eDue
                      ? format(eDue, "PPP", { locale: dateFnsLocale })
                      : t("pickDate")}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={eDue}
                    onSelect={setEDue}
                    locale={dateFnsLocale}
                  />
                  {eDue ? (
                    <div className="border-t p-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="w-full"
                        onClick={() => setEDue(undefined)}
                      >
                        {t("clearDate")}
                      </Button>
                    </div>
                  ) : null}
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <SheetFooter className="mt-auto border-t pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => setEditOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              className="flex-1"
              disabled={saving}
              onClick={() => void saveEdit()}
            >
              {saving ? <Spinner className="size-4" /> : tCommon("save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={deleteTarget != null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              {tCommon("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
