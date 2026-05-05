"use client";

import type { OrganizationalPosition, PositionCategory } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
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
import { DashboardBreadcrumbs } from "@/components/layout/dashboard-breadcrumbs";
import { Link, useRouter } from "@/lib/i18n/routing";
import { usePermissions } from "@/lib/permissions-context";
import { cn } from "@/lib/utils";

const CATEGORIES: PositionCategory[] = [
  "BOARD",
  "EXECUTIVE",
  "TECHNICAL",
  "ADMINISTRATIVE",
];

function categoryTranslationKey(c: PositionCategory) {
  switch (c) {
    case "BOARD":
      return "categoryBoard";
    case "EXECUTIVE":
      return "categoryExecutive";
    case "TECHNICAL":
      return "categoryTechnical";
    case "ADMINISTRATIVE":
      return "categoryAdministrative";
    default:
      return "categoryBoard";
  }
}

function categoryBadgeClass(c: PositionCategory) {
  switch (c) {
    case "BOARD":
      return "border-violet-500/40 bg-violet-500/10 text-violet-900 dark:text-violet-100";
    case "EXECUTIVE":
      return "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    case "TECHNICAL":
      return "border-sky-500/40 bg-sky-500/10 text-sky-900 dark:text-sky-100";
    case "ADMINISTRATIVE":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-900 dark:text-emerald-100";
    default:
      return "";
  }
}

type FormState = {
  code: string;
  labelAr: string;
  labelEn: string;
  level: number;
  sortOrder: number;
  category: PositionCategory;
  isActive: boolean;
};

const defaultForm: FormState = {
  code: "",
  labelAr: "",
  labelEn: "",
  level: 0,
  sortOrder: 0,
  category: "BOARD",
  isActive: true,
};

function toForm(p: OrganizationalPosition): FormState {
  return {
    code: p.code,
    labelAr: p.labelAr,
    labelEn: p.labelEn ?? "",
    level: p.level,
    sortOrder: p.sortOrder,
    category: p.category,
    isActive: p.isActive,
  };
}

export default function PositionsSettingsPage() {
  const { status } = useSession();
  const perms = usePermissions();
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("positions");
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");

  const [rows, setRows] = useState<OrganizationalPosition[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<FormState>(defaultForm);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editCode, setEditCode] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<FormState>(defaultForm);
  const [editSubmitting, setEditSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationalPosition | null>(
    null,
  );
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const canManage = perms.canManagePositions;

  const load = useCallback(async () => {
    if (!canManage) return;
    setLoadingList(true);
    try {
      const res = await fetch("/api/positions", { credentials: "include" });
      if (!res.ok) {
        toast.error(t("loadError"));
        return;
      }
      const data = (await res.json()) as { positions: OrganizationalPosition[] };
      setRows(data.positions ?? []);
    } finally {
      setLoadingList(false);
    }
  }, [canManage, t]);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && canManage) {
      void load();
    }
  }, [status, canManage, load]);

  const openCreate = () => {
    setCreateForm(defaultForm);
    setCreateOpen(true);
  };

  const openEdit = (p: OrganizationalPosition) => {
    setEditCode(p.code);
    setEditForm(toForm(p));
    setEditOpen(true);
  };

  const submitCreate = async () => {
    const code = createForm.code.trim().toUpperCase();
    if (!code) {
      toast.error(t("requiredCode"));
      return;
    }
    if (!createForm.labelAr.trim()) {
      toast.error(t("requiredLabelAr"));
      return;
    }
    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          labelAr: createForm.labelAr.trim(),
          labelEn: createForm.labelEn.trim() || null,
          level: createForm.level,
          category: createForm.category,
          sortOrder: createForm.sortOrder,
          isActive: createForm.isActive,
        }),
      });
      if (res.status === 409) {
        toast.error(t("duplicateCodeError"));
        return;
      }
      if (!res.ok) {
        toast.error(t("createError"));
        return;
      }
      toast.success(t("createdToast"));
      setCreateOpen(false);
      await load();
    } finally {
      setCreateSubmitting(false);
    }
  };

  const submitEdit = async () => {
    if (!editCode) return;
    if (!editForm.labelAr.trim()) {
      toast.error(t("requiredLabelAr"));
      return;
    }
    setEditSubmitting(true);
    try {
      const res = await fetch(
        `/api/positions/${encodeURIComponent(editCode)}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            labelAr: editForm.labelAr.trim(),
            labelEn: editForm.labelEn.trim() || null,
            level: editForm.level,
            category: editForm.category,
            sortOrder: editForm.sortOrder,
            isActive: editForm.isActive,
          }),
        },
      );
      if (!res.ok) {
        toast.error(t("updateError"));
        return;
      }
      toast.success(t("updatedToast"));
      setEditOpen(false);
      setEditCode(null);
      await load();
    } finally {
      setEditSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleteSubmitting(true);
    try {
      const res = await fetch(
        `/api/positions/${encodeURIComponent(deleteTarget.code)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (res.status === 409) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (body.error === "POSITION_HAS_USERS") {
          toast.error(t("deleteAssignedUsers"));
          return;
        }
      }
      if (!res.ok) {
        toast.error(t("deleteError"));
        return;
      }
      toast.success(t("deletedToast"));
      setDeleteOpen(false);
      setDeleteTarget(null);
      await load();
    } finally {
      setDeleteSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Spinner className="size-8" />
      </div>
    );
  }

  if (status === "authenticated" && !canManage) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-4">
        <Alert variant="destructive">
          <AlertTitle>{t("accessDenied")}</AlertTitle>
          <AlertDescription className="mt-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">{t("backToDashboard")}</Link>
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <DashboardBreadcrumbs
        items={[
          { label: tNav("dashboard"), href: "/dashboard" },
          { label: tNav("settings"), href: "/settings" },
          { label: t("pageTitle") },
        ]}
      />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("pageTitle")}</h1>
          <p className="text-muted-foreground mt-1 text-sm">{t("pageSubtitle")}</p>
        </div>
        <Button type="button" onClick={openCreate}>
          {t("addPosition")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colCode")}</TableHead>
              <TableHead>{t("colLabelAr")}</TableHead>
              <TableHead>{t("colLabelEn")}</TableHead>
              <TableHead className="w-[72px]">{t("colLevel")}</TableHead>
              <TableHead>{t("colCategory")}</TableHead>
              <TableHead className="w-[96px]">{t("colSortOrder")}</TableHead>
              <TableHead className="w-[100px]">{t("colActive")}</TableHead>
              <TableHead className="w-[140px] text-end">{t("colActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loadingList ? (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-10" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-6 w-14 rounded-full" />
                    </TableCell>
                    <TableCell className="text-end">
                      <div className="flex justify-end gap-1">
                        <Skeleton className="h-8 w-14" />
                        <Skeleton className="h-8 w-14" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-muted-foreground h-24 text-center text-sm"
                >
                  {t("emptyTable")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((p) => (
                <TableRow key={p.code}>
                  <TableCell className="font-mono text-sm font-medium">
                    {p.code}
                  </TableCell>
                  <TableCell>{p.labelAr}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {p.labelEn ?? "—"}
                  </TableCell>
                  <TableCell>{p.level}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={cn("font-normal", categoryBadgeClass(p.category))}
                    >
                      {t(categoryTranslationKey(p.category))}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.sortOrder}</TableCell>
                  <TableCell>
                    {p.isActive ? (
                      <Badge variant="secondary">{t("statusActive")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("statusInactive")}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(p)}
                      >
                        {tCommon("edit")}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeleteTarget(p);
                          setDeleteOpen(true);
                        }}
                      >
                        {tCommon("delete")}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("createDialogTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="pos-code">{t("fieldCode")}</Label>
              <Input
                id="pos-code"
                value={createForm.code}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, code: e.target.value }))
                }
                placeholder="CHAIR"
                autoComplete="off"
              />
              <p className="text-muted-foreground text-xs">{t("fieldCodeHint")}</p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-label-ar">{t("fieldLabelAr")}</Label>
              <Input
                id="pos-label-ar"
                value={createForm.labelAr}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, labelAr: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="pos-label-en">{t("fieldLabelEn")}</Label>
              <Input
                id="pos-label-en"
                value={createForm.labelEn}
                onChange={(e) =>
                  setCreateForm((f) => ({ ...f, labelEn: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="pos-level">{t("fieldLevel")}</Label>
                <Input
                  id="pos-level"
                  type="number"
                  value={String(createForm.level)}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      level: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="pos-sort">{t("fieldSortOrder")}</Label>
                <Input
                  id="pos-sort"
                  type="number"
                  value={String(createForm.sortOrder)}
                  onChange={(e) =>
                    setCreateForm((f) => ({
                      ...f,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("fieldCategory")}</Label>
              <Select
                value={createForm.category}
                onValueChange={(v) =>
                  setCreateForm((f) => ({
                    ...f,
                    category: v as PositionCategory,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(categoryTranslationKey(c))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <Label htmlFor="pos-active-create" className="cursor-pointer">
                {t("fieldActive")}
              </Label>
              <Switch
                id="pos-active-create"
                checked={createForm.isActive}
                onCheckedChange={(checked) =>
                  setCreateForm((f) => ({ ...f, isActive: checked }))
                }
              />
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
              onClick={() => void submitCreate()}
              disabled={createSubmitting}
            >
              {createSubmitting ? <Spinner className="size-4" /> : tCommon("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side={locale === "ar" ? "left" : "right"}
          className="flex w-full max-w-md flex-col"
        >
          <SheetHeader>
            <SheetTitle>{t("editSheetTitle")}</SheetTitle>
            <SheetDescription className="font-mono">{editCode}</SheetDescription>
          </SheetHeader>
          <div className="mt-4 grid flex-1 gap-4 overflow-y-auto py-2">
            <div className="grid gap-2">
              <Label>{t("fieldCode")}</Label>
              <Input value={editForm.code} readOnly disabled className="bg-muted" />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-label-ar">{t("fieldLabelAr")}</Label>
              <Input
                id="edit-label-ar"
                value={editForm.labelAr}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, labelAr: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-label-en">{t("fieldLabelEn")}</Label>
              <Input
                id="edit-label-en"
                value={editForm.labelEn}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, labelEn: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 sm:gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-level">{t("fieldLevel")}</Label>
                <Input
                  id="edit-level"
                  type="number"
                  value={String(editForm.level)}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      level: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-sort">{t("fieldSortOrder")}</Label>
                <Input
                  id="edit-sort"
                  type="number"
                  value={String(editForm.sortOrder)}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      sortOrder: Number(e.target.value) || 0,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>{t("fieldCategory")}</Label>
              <Select
                value={editForm.category}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    category: v as PositionCategory,
                  }))
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {t(categoryTranslationKey(c))}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
              <Label htmlFor="pos-active-edit" className="cursor-pointer">
                {t("fieldActive")}
              </Label>
              <Switch
                id="pos-active-edit"
                checked={editForm.isActive}
                onCheckedChange={(checked) =>
                  setEditForm((f) => ({ ...f, isActive: checked }))
                }
              />
            </div>
          </div>
          <SheetFooter className="mt-auto gap-2 border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditOpen(false)}
            >
              {tCommon("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void submitEdit()}
              disabled={editSubmitting}
            >
              {editSubmitting ? <Spinner className="size-4" /> : tCommon("save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget ? (
                <span className="font-mono">{deleteTarget.code}</span>
              ) : null}{" "}
              — {t("deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteSubmitting}>
              {tCommon("cancel")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleteSubmitting}
              onClick={() => void confirmDelete()}
            >
              {deleteSubmitting ? <Spinner className="size-4" /> : tCommon("delete")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
