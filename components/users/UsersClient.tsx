"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  Copy,
  Loader2,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  UserMinus,
  UserPlus,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import type { AdminBoardUserJson } from "@/lib/admin-board-user";
import { BOARD_ROLES, getRoleLabel } from "@/lib/board-roles";
import { getDefaultPermissions } from "@/lib/board-permission-defs";
import type { BoardRole } from "@prisma/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { usePlanUpgrade } from "@/components/plan/plan-upgrade-provider";
import type { PlanLimitApiBody } from "@/lib/plan-limits-config";

const ROLE_FILTER_ALL = "ALL" as const;
const PAGE_SIZE = 20;

type SortKey = "name" | "email" | "role";
type SortDir = "asc" | "desc";

const PERM_KEYS = [
  "permCreateMeetings",
  "permEditMeetings",
  "permManageMeetings",
  "permCreateVotes",
  "permCastVotes",
  "permCreateDecisions",
  "permEditDecisions",
  "permFinalizeMinutes",
  "permManagePositions",
  "permManageUsers",
] as const;

type PermKey = (typeof PERM_KEYS)[number];

const PERM_MSG_KEYS: Record<PermKey, `perm.${PermKey}`> = {
  permCreateMeetings: "perm.permCreateMeetings",
  permEditMeetings: "perm.permEditMeetings",
  permManageMeetings: "perm.permManageMeetings",
  permCreateVotes: "perm.permCreateVotes",
  permCastVotes: "perm.permCastVotes",
  permCreateDecisions: "perm.permCreateDecisions",
  permEditDecisions: "perm.permEditDecisions",
  permFinalizeMinutes: "perm.permFinalizeMinutes",
  permManagePositions: "perm.permManagePositions",
  permManageUsers: "perm.permManageUsers",
};

type EditDraft = {
  name: string;
  email: string;
  role: BoardRole;
  positionCode: string | null;
  isActive: boolean;
} & Record<PermKey, boolean>;

type PositionOption = {
  code: string;
  labelAr: string;
  labelEn: string | null;
};

function userToDraft(u: AdminBoardUserJson): EditDraft {
  return {
    name: u.name,
    email: u.email,
    role: u.role,
    positionCode: u.positionCode,
    isActive: u.isActive,
    permCreateMeetings: u.permCreateMeetings,
    permEditMeetings: u.permEditMeetings,
    permManageMeetings: u.permManageMeetings,
    permCreateVotes: u.permCreateVotes,
    permCastVotes: u.permCastVotes,
    permCreateDecisions: u.permCreateDecisions,
    permEditDecisions: u.permEditDecisions,
    permFinalizeMinutes: u.permFinalizeMinutes,
    permManagePositions: u.permManagePositions,
    permManageUsers: u.permManageUsers,
  };
}

function positionLabel(p: PositionOption, locale: "ar" | "en") {
  if (locale === "ar") return p.labelAr;
  return p.labelEn?.trim() ? p.labelEn : p.labelAr;
}

export function UsersClient({
  locale,
  currentUserId,
  initialUsers,
  positions,
}: {
  locale: "ar" | "en";
  currentUserId: string;
  initialUsers: AdminBoardUserJson[];
  positions: PositionOption[];
}) {
  const t = useTranslations("users");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { showPlanUpgradeFromApiBody } = usePlanUpgrade();

  const [search, setSearch] = React.useState("");
  const [roleFilter, setRoleFilter] = React.useState<
    typeof ROLE_FILTER_ALL | BoardRole
  >(ROLE_FILTER_ALL);

  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [inviteSetupFullUrl, setInviteSetupFullUrl] = React.useState<
    string | null
  >(null);
  const [inviteName, setInviteName] = React.useState("");
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<BoardRole>("MEMBER");
  const [invitePosition, setInvitePosition] = React.useState<string>("");
  const [inviteSubmitting, setInviteSubmitting] = React.useState(false);

  const [sortKey, setSortKey] = React.useState<SortKey>("name");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");
  const [page, setPage] = React.useState(1);

  const [inviteLinkSubmittingId, setInviteLinkSubmittingId] = React.useState<
    string | null
  >(null);
  const [inviteLinkDialogOpen, setInviteLinkDialogOpen] = React.useState(false);
  const [inviteLinkFullUrl, setInviteLinkFullUrl] = React.useState<
    string | null
  >(null);

  const [sheetUser, setSheetUser] = React.useState<AdminBoardUserJson | null>(
    null,
  );
  const [draft, setDraft] = React.useState<EditDraft | null>(null);
  const [saveSubmitting, setSaveSubmitting] = React.useState(false);

  const [deactivateTarget, setDeactivateTarget] =
    React.useState<AdminBoardUserJson | null>(null);

  React.useEffect(() => {
    if (!sheetUser) {
      setDraft(null);
      return;
    }
    setDraft(userToDraft(sheetUser));
  }, [sheetUser]);

  const dateFmt = React.useMemo(
    () =>
      new Intl.DateTimeFormat(locale === "ar" ? "ar-SA" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
      }),
    [locale],
  );

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return initialUsers.filter((u) => {
      if (roleFilter !== ROLE_FILTER_ALL && u.role !== roleFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
      );
    });
  }, [initialUsers, search, roleFilter]);

  React.useEffect(() => {
    setPage(1);
  }, [search, roleFilter]);

  const sorted = React.useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name") {
        cmp = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      } else if (sortKey === "email") {
        cmp = a.email.localeCompare(b.email, undefined, {
          sensitivity: "base",
        });
      } else {
        cmp = a.role.localeCompare(b.role);
      }
      return cmp * dir;
    });
    return arr;
  }, [filtered, sortDir, sortKey]);

  const totalFiltered = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE));

  React.useEffect(() => {
    setPage((p) =>
      Math.min(p, Math.max(1, Math.ceil(totalFiltered / PAGE_SIZE))),
    );
  }, [totalFiltered]);

  const safePage = Math.min(page, totalPages);
  const paged = React.useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [sorted, safePage]);

  function onSortHeader(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function sortIcon(key: SortKey) {
    if (sortKey !== key) return null;
    return sortDir === "asc" ? (
      <ArrowUp className="size-3 opacity-70" aria-hidden />
    ) : (
      <ArrowDown className="size-3 opacity-70" aria-hidden />
    );
  }

  async function issueNewInviteLink(u: AdminBoardUserJson) {
    setInviteLinkSubmittingId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}/invite-link`, {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        setupFullUrl?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? tCommon("errorOccurred"));
        return;
      }
      toast.success(t("toastInviteLinkIssued"));
      if (data.setupFullUrl && typeof window !== "undefined") {
        setInviteLinkFullUrl(data.setupFullUrl);
        setInviteLinkDialogOpen(true);
      }
      router.refresh();
    } finally {
      setInviteLinkSubmittingId(null);
    }
  }

  async function onInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteSubmitting(true);
    try {
      const body = {
        name: inviteName.trim(),
        email: inviteEmail.trim(),
        role: inviteRole,
        positionCode: invitePosition || null,
      };
      const res = await fetch("/api/users", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => ({}))) as PlanLimitApiBody & {
        user?: unknown;
        setupUrl?: string;
        setupFullUrl?: string;
      };
      if (!res.ok) {
        if (res.status === 403 && data.upgradeRequired) {
          showPlanUpgradeFromApiBody(data, locale);
          return;
        }
        toast.error(data.error ?? tCommon("errorOccurred"));
        return;
      }
      toast.success(t("toastInvited"));
      if (typeof window !== "undefined" && (data.setupFullUrl || data.setupUrl)) {
        const full =
          typeof data.setupFullUrl === "string" && data.setupFullUrl.startsWith("http")
            ? data.setupFullUrl
            : (() => {
                const path = (data.setupUrl ?? "").startsWith("/")
                  ? (data.setupUrl as string)
                  : `/${data.setupUrl ?? ""}`;
                return `${window.location.origin}/${locale}${path}`;
              })();
        setInviteSetupFullUrl(full);
      } else {
        setInviteOpen(false);
        setInviteName("");
        setInviteEmail("");
        setInviteRole("MEMBER");
        setInvitePosition("");
      }
      router.refresh();
    } finally {
      setInviteSubmitting(false);
    }
  }

  async function patchUser(
    id: string,
    body: Record<string, unknown>,
  ): Promise<boolean> {
    const res = await fetch(`/api/users/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      toast.error(err.error ?? tCommon("errorOccurred"));
      return false;
    }
    return true;
  }

  async function onSaveEdit() {
    if (!sheetUser || !draft) return;
    setSaveSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        name: draft.name.trim(),
        role: draft.role,
        positionCode: draft.positionCode,
        isActive: draft.isActive,
      };
      for (const k of PERM_KEYS) {
        body[k] = draft[k];
      }
      const ok = await patchUser(sheetUser.id, body);
      if (ok) {
        toast.success(t("toastUpdated"));
        setSheetUser(null);
        router.refresh();
      }
    } finally {
      setSaveSubmitting(false);
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return;
    const ok = await patchUser(deactivateTarget.id, { isActive: false });
    if (ok) {
      toast.success(t("toastUpdated"));
      setDeactivateTarget(null);
      router.refresh();
    }
  }

  async function activateUser(u: AdminBoardUserJson) {
    const ok = await patchUser(u.id, { isActive: true });
    if (ok) {
      toast.success(t("toastUpdated"));
      router.refresh();
    }
  }

  function setPerm(key: PermKey, value: boolean) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function resetPermissionsToRole() {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, ...getDefaultPermissions(d.role) };
    });
  }

  function onEditRoleChange(role: BoardRole) {
    setDraft((d) => {
      if (!d) return d;
      return { ...d, role, ...getDefaultPermissions(role) };
    });
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <Button
          type="button"
          disabled={inviteSubmitting}
          onClick={() => {
            setInviteSetupFullUrl(null);
            setInviteOpen(true);
          }}
        >
          <UserPlus className="me-2 size-4" />
          {t("invite")}
        </Button>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="max-w-md flex-1 space-y-2">
          <Label htmlFor="user-search">{t("searchLabel")}</Label>
          <Input
            id="user-search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
          />
        </div>
        <div className="w-full max-w-xs space-y-2">
          <Label>{t("filterRoleLabel")}</Label>
          <Select
            value={roleFilter}
            onValueChange={(v) =>
              setRoleFilter(v === ROLE_FILTER_ALL ? ROLE_FILTER_ALL : (v as BoardRole))
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ROLE_FILTER_ALL}>{t("filterRoleAll")}</SelectItem>
              {BOARD_ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {getRoleLabel(r, locale)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-muted-foreground text-sm">
        {t("totalUsers", { count: totalFiltered })}
      </p>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">{t("columnAvatar")}</TableHead>
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  onClick={() => onSortHeader("name")}
                >
                  {t("columnName")}
                  {sortIcon("name")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  onClick={() => onSortHeader("email")}
                >
                  {t("columnEmail")}
                  {sortIcon("email")}
                </button>
              </TableHead>
              <TableHead>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 font-medium hover:underline"
                  onClick={() => onSortHeader("role")}
                >
                  {t("columnRole")}
                  {sortIcon("role")}
                </button>
              </TableHead>
              <TableHead>{t("columnPosition")}</TableHead>
              <TableHead>{t("columnStatus")}</TableHead>
              <TableHead>{t("columnUpdated")}</TableHead>
              <TableHead className="w-12 text-end">{t("columnActions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-muted-foreground h-24 text-center">
                  {t("emptyState")}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((u) => {
                const posLabel =
                  locale === "ar"
                    ? (u.positionLabelAr ?? u.positionLabelEn)
                    : (u.positionLabelEn ?? u.positionLabelAr);
                const initial = (u.name?.trim()?.[0] ?? u.email?.[0] ?? "?").toUpperCase();
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Avatar className="size-8">
                        {u.avatar ? (
                          <AvatarImage src={u.avatar} alt="" />
                        ) : null}
                        <AvatarFallback className="text-xs font-medium">
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                    </TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getRoleLabel(u.role, locale)}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground">
                      {posLabel ?? "—"}
                    </TableCell>
                    <TableCell>
                      {u.isActive ? (
                        <Badge className="border-0 bg-emerald-600 text-white hover:bg-emerald-600/90">
                          {t("statusActive")}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">{t("statusInactive")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {dateFmt.format(new Date(u.updatedAt))}
                    </TableCell>
                    <TableCell className="text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            aria-label={t("columnActions")}
                          >
                            <MoreHorizontal className="size-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setSheetUser(u)}>
                            <Pencil className="me-2 size-4" />
                            {t("actionsEdit")}
                          </DropdownMenuItem>
                          {!u.hasPassword && u.isActive ? (
                            <DropdownMenuItem
                              disabled={inviteLinkSubmittingId === u.id}
                              onClick={() => void issueNewInviteLink(u)}
                            >
                              {inviteLinkSubmittingId === u.id ? (
                                <Loader2 className="me-2 size-4 animate-spin" />
                              ) : (
                                <RefreshCw className="me-2 size-4" />
                              )}
                              {t("issueInviteLink")}
                            </DropdownMenuItem>
                          ) : null}
                          {u.isActive && u.id !== currentUserId ? (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => setDeactivateTarget(u)}
                            >
                              <UserMinus className="me-2 size-4" />
                              {t("actionsDeactivate")}
                            </DropdownMenuItem>
                          ) : null}
                          {!u.isActive ? (
                            <DropdownMenuItem onClick={() => void activateUser(u)}>
                              <UserPlus className="me-2 size-4" />
                              {t("actionsActivate")}
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 ? (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-muted-foreground text-sm tabular-nums">
            {t("paginationPage", { page: safePage, total: totalPages })}
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage <= 1}
              onClick={() => setPage(Math.max(1, safePage - 1))}
            >
              {t("paginationPrev")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            >
              {t("paginationNext")}
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog
        open={inviteLinkDialogOpen}
        onOpenChange={(open) => {
          setInviteLinkDialogOpen(open);
          if (!open) setInviteLinkFullUrl(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("inviteSuccessTitle")}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <Alert>
              <AlertTitle>{t("inviteSetupLinkTitle")}</AlertTitle>
              <AlertDescription>{t("inviteSetupLinkDescription")}</AlertDescription>
            </Alert>
            {inviteLinkFullUrl ? (
              <div className="flex flex-col gap-2 sm:flex-row">
                <Input readOnly value={inviteLinkFullUrl} className="font-mono text-xs" />
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(inviteLinkFullUrl);
                      toast.success(t("inviteCopiedToast"));
                    } catch {
                      toast.error(tCommon("errorOccurred"));
                    }
                  }}
                >
                  <Copy className="me-2 size-4" />
                  {t("inviteCopyLink")}
                </Button>
              </div>
            ) : null}
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => {
                setInviteLinkDialogOpen(false);
              }}
            >
              {t("inviteDone")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={inviteOpen}
        onOpenChange={(open) => {
          setInviteOpen(open);
          if (!open) {
            setInviteSetupFullUrl(null);
            setInviteName("");
            setInviteEmail("");
            setInviteRole("MEMBER");
            setInvitePosition("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {inviteSetupFullUrl ? (
            <>
              <DialogHeader>
                <DialogTitle>{t("inviteSuccessTitle")}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <Alert>
                  <AlertTitle>{t("inviteSetupLinkTitle")}</AlertTitle>
                  <AlertDescription>{t("inviteSetupLinkDescription")}</AlertDescription>
                </Alert>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input readOnly value={inviteSetupFullUrl} className="font-mono text-xs" />
                  <Button
                    type="button"
                    variant="secondary"
                    className="shrink-0"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(inviteSetupFullUrl);
                        toast.success(t("inviteCopiedToast"));
                      } catch {
                        toast.error(tCommon("errorOccurred"));
                      }
                    }}
                  >
                    <Copy className="me-2 size-4" />
                    {t("inviteCopyLink")}
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  onClick={() => {
                    setInviteOpen(false);
                  }}
                >
                  {t("inviteDone")}
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={onInviteSubmit}>
              <DialogHeader>
                <DialogTitle>{t("inviteDialogTitle")}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="invite-name">{t("name")} *</Label>
                  <Input
                    id="invite-name"
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="invite-email">{t("email")} *</Label>
                  <Input
                    id="invite-email"
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label>{t("role")}</Label>
                  <Select
                    value={inviteRole}
                    onValueChange={(v) => setInviteRole(v as BoardRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARD_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {getRoleLabel(r, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("positionLabel")}</Label>
                  <Select
                    value={invitePosition || "__none__"}
                    onValueChange={(v) =>
                      setInvitePosition(v === "__none__" ? "" : v)
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("positionNone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("positionNone")}</SelectItem>
                      {positions.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {positionLabel(p, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setInviteOpen(false)}
                >
                  {t("cancel")}
                </Button>
                <Button type="submit" disabled={inviteSubmitting}>
                  {inviteSubmitting ? (
                    <Loader2 className="me-2 size-4 animate-spin" />
                  ) : null}
                  {t("inviteSubmit")}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Sheet
        open={Boolean(sheetUser)}
        onOpenChange={(o) => {
          if (!o) setSheetUser(null);
        }}
      >
        <SheetContent
          className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg"
          side={locale === "ar" ? "left" : "right"}
        >
          <SheetHeader>
            <SheetTitle>{t("editSheetTitle")}</SheetTitle>
          </SheetHeader>
          {draft ? (
            <div className="flex flex-1 flex-col gap-6 py-6">
              <section className="space-y-4 px-1">
                <h3 className="text-sm font-medium">{t("sectionProfile")}</h3>
                <div className="grid gap-2">
                  <Label htmlFor="edit-name">{t("name")}</Label>
                  <Input
                    id="edit-name"
                    value={draft.name}
                    onChange={(e) =>
                      setDraft((d) => (d ? { ...d, name: e.target.value } : d))
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-email">{t("email")}</Label>
                  <Input id="edit-email" value={draft.email} readOnly disabled />
                </div>
                <div className="grid gap-2">
                  <Label>{t("role")}</Label>
                  <Select
                    value={draft.role}
                    onValueChange={(v) => onEditRoleChange(v as BoardRole)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOARD_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          {getRoleLabel(r, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>{t("positionLabel")}</Label>
                  <Select
                    value={draft.positionCode ?? "__none__"}
                    onValueChange={(v) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              positionCode: v === "__none__" ? null : v,
                            }
                          : d,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("positionNone")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{t("positionNone")}</SelectItem>
                      {positions.map((p) => (
                        <SelectItem key={p.code} value={p.code}>
                          {positionLabel(p, locale)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <Label htmlFor="edit-active">{t("isActiveLabel")}</Label>
                    <p className="text-muted-foreground text-xs">
                      {t("isActiveHint")}
                    </p>
                  </div>
                  <Switch
                    id="edit-active"
                    checked={draft.isActive}
                    onCheckedChange={(c) =>
                      setDraft((d) =>
                        d
                          ? {
                              ...d,
                              isActive: Boolean(c),
                            }
                          : d,
                      )
                    }
                    disabled={sheetUser?.id === currentUserId}
                  />
                </div>
                {sheetUser?.id === currentUserId ? (
                  <p className="text-muted-foreground text-xs">
                    {t("cannotDeactivateSelfHint")}
                  </p>
                ) : null}
              </section>

              <section className="space-y-4 px-1">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-medium">{t("sectionPermissions")}</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={resetPermissionsToRole}
                  >
                    {t("resetRoleDefaults")}
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {PERM_KEYS.map((key) => (
                    <label
                      key={key}
                      className="hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-md border p-3"
                    >
                      <Checkbox
                        checked={draft[key]}
                        onCheckedChange={(c) => setPerm(key, c === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm leading-snug">
                        {t(PERM_MSG_KEYS[key])}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          ) : null}
          <SheetFooter className="mt-auto gap-2 border-t pt-4">
            <Button type="button" variant="outline" onClick={() => setSheetUser(null)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={() => void onSaveEdit()}
              disabled={!draft || saveSubmitting}
            >
              {saveSubmitting ? (
                <Spinner className="me-2 size-4" />
              ) : null}
              {t("save")}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <AlertDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(o) => {
          if (!o) setDeactivateTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeactivateTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {deactivateTarget
                ? t("confirmDeactivateDescription", {
                    name: deactivateTarget.name,
                  })
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeactivate()}
            >
              {t("confirmDeactivateAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
