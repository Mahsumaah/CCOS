"use client";

import type { BoardRole, DelegationScope, Plan } from "@prisma/client";
import { Lock, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { usePlanUpgrade } from "@/components/plan/plan-upgrade-provider";
import { getRoleLabel } from "@/lib/board-roles";
import { getPlanLimits, type PlanLimitApiBody } from "@/lib/plan-limits-config";
import { formatDateTime } from "@/lib/format";
import { usePermissions } from "@/lib/permissions-context";
import { uploadFile } from "@/lib/upload";
import { cn } from "@/lib/utils";

export type DelegationDTO = {
  id: string;
  scope: DelegationScope;
  authDocUrl: string | null;
  authDocName: string | null;
  revokedAt: string | null;
  createdAt: string;
  fromUser: { id: string; name: string; role: BoardRole };
  toUser: { id: string; name: string; role: BoardRole };
};

type Invitee = {
  userId: string;
  user: { id: string; name: string; role: BoardRole };
};

function scopeBadgeClass(scope: DelegationScope): string {
  if (scope === "ATTENDANCE_ONLY") {
    return "bg-blue-600 text-white hover:bg-blue-600/90";
  }
  return "bg-emerald-600 text-white hover:bg-emerald-600/90";
}

export function DelegationsSection({
  meetingId,
  currentUserId,
  locale,
  tenantPlan,
  invitees,
}: {
  meetingId: string;
  currentUserId: string;
  locale: "ar" | "en";
  tenantPlan: Plan;
  invitees: Invitee[];
}) {
  const perms = usePermissions();
  const t = useTranslations("delegations");
  const tCommon = useTranslations("common");
  const tPlan = useTranslations("planUpgrade");
  const { showPlanUpgrade, showPlanUpgradeFromApiBody } = usePlanUpgrade();
  const canDelegatePlan = useMemo(
    () => getPlanLimits(tenantPlan).canDelegate,
    [tenantPlan],
  );
  const [loading, setLoading] = useState(true);
  const [delegations, setDelegations] = useState<DelegationDTO[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [scope, setScope] = useState<DelegationScope>("ATTENDANCE_ONLY");
  const [file, setFile] = useState<File | null>(null);
  const [revokeId, setRevokeId] = useState<string | null>(null);

  const fetchDelegations = useCallback(async () => {
    try {
      const res = await fetch(`/api/meetings/${meetingId}/delegations`, {
        credentials: "include",
      });
      if (!res.ok) return;
      const data = (await res.json()) as { delegations: DelegationDTO[] };
      setDelegations(data.delegations ?? []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void fetchDelegations();
  }, [fetchDelegations]);

  const activeOutgoingFrom = useMemo(() => {
    const set = new Set<string>();
    for (const d of delegations) {
      if (!d.revokedAt) set.add(d.fromUser.id);
    }
    return set;
  }, [delegations]);

  const fromOptions = useMemo(
    () =>
      invitees.filter((inv) => !activeOutgoingFrom.has(inv.userId)),
    [invitees, activeOutgoingFrom],
  );

  const canAddAnyDelegation = perms.canManageMeetings;
  const canAddSelfDelegation =
    invitees.some((i) => i.userId === currentUserId) &&
    !activeOutgoingFrom.has(currentUserId);
  const showAddButton = canAddAnyDelegation || canAddSelfDelegation;

  const openCreate = () => {
    if (!canDelegatePlan) {
      showPlanUpgrade(tPlan("delegateBlocked"));
      return;
    }
    if (!perms.canManageMeetings) {
      setFromId(currentUserId);
    } else {
      setFromId(fromOptions[0]?.userId ?? "");
    }
    setToId("");
    setScope("ATTENDANCE_ONLY");
    setFile(null);
    setCreateOpen(true);
  };

  const submitCreate = async () => {
    if (!fromId || !toId) {
      toast.error(t("pickFromTo"));
      return;
    }
    if (fromId === toId) {
      toast.error(t("fromToDifferent"));
      return;
    }
    const canCreate =
      perms.canManageMeetings || fromId === currentUserId;
    if (!canCreate) {
      toast.error(t("forbidden"));
      return;
    }
    setSaving(true);
    try {
      let auth:
        | {
            authDocUrl: string;
            authDocName: string;
            authDocMime: string;
            authDocSize: number;
          }
        | undefined;
      if (file) {
        const up = await uploadFile(file, "/ccos/delegations");
        auth = {
          authDocUrl: up.url,
          authDocName: up.name,
          authDocMime: up.mime,
          authDocSize: up.size,
        };
      }

      const res = await fetch(`/api/meetings/${meetingId}/delegations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          fromUserId: fromId,
          toUserId: toId,
          scope,
          ...auth,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as PlanLimitApiBody & {
          error?: string;
        };
        if (res.status === 403 && body.upgradeRequired) {
          showPlanUpgradeFromApiBody(body, locale);
          return;
        }
        toast.error(body.error ?? t("createError"));
        return;
      }
      toast.success(t("created"));
      setCreateOpen(false);
      await fetchDelegations();
    } catch (e) {
      console.error(e);
      toast.error(e instanceof Error ? e.message : tCommon("errorOccurred"));
    } finally {
      setSaving(false);
    }
  };

  const revoke = async () => {
    if (!revokeId) return;
    setSaving(true);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/delegations/${revokeId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) {
        toast.error(t("revokeError"));
        return;
      }
      toast.success(t("revoked"));
      setRevokeId(null);
      await fetchDelegations();
    } finally {
      setSaving(false);
    }
  };

  const toOptions = useMemo(
    () => invitees.filter((inv) => inv.userId !== fromId),
    [invitees, fromId],
  );

  const scopeLabel = (s: DelegationScope) =>
    s === "ATTENDANCE_ONLY" ? t("scopeAttendanceOnly") : t("scopeAttendanceVoting");

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-6" />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">{t("sectionTitle")}</h2>
        {showAddButton ? (
          <div className="relative inline-flex shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(!canDelegatePlan && "pe-10")}
              onClick={openCreate}
            >
              {t("addDelegation")}
            </Button>
            {!canDelegatePlan ? (
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
        ) : null}
      </div>

      {delegations.length === 0 ? (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      ) : (
        <ul className="space-y-3">
          {delegations.map((d) => {
            const active = !d.revokedAt;
            const canRevoke =
              active &&
              (perms.canManageMeetings || d.fromUser.id === currentUserId);
            return (
              <li key={d.id}>
                <Card>
                  <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0 pb-2">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="secondary"
                          className={cn(scopeBadgeClass(d.scope))}
                        >
                          {scopeLabel(d.scope)}
                        </Badge>
                        {active ? (
                          <Badge variant="outline" className="font-normal">
                            {t("statusActive")}
                          </Badge>
                        ) : (
                          <Badge variant="destructive">{t("statusRevoked")}</Badge>
                        )}
                      </div>
                      <CardTitle className="text-sm font-medium leading-relaxed">
                        <span className="text-muted-foreground">{t("from")}</span>{" "}
                        <span className="text-foreground">{d.fromUser.name}</span>{" "}
                        <Badge variant="outline" className="ms-1 align-middle font-normal">
                          {getRoleLabel(d.fromUser.role, locale)}
                        </Badge>
                      </CardTitle>
                      <p className="text-sm">
                        <span className="text-muted-foreground">{t("to")}</span>{" "}
                        <span className="font-medium">{d.toUser.name}</span>{" "}
                        <Badge variant="outline" className="ms-1 align-middle font-normal">
                          {getRoleLabel(d.toUser.role, locale)}
                        </Badge>
                      </p>
                      {d.authDocName && d.authDocUrl ? (
                        <p className="text-sm">
                          {d.authDocUrl.startsWith("placeholder") ? (
                            <span className="text-muted-foreground">
                              {d.authDocName}
                            </span>
                          ) : (
                            <a
                              href={d.authDocUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              {d.authDocName}
                            </a>
                          )}
                        </p>
                      ) : null}
                      <p className="text-muted-foreground text-xs">
                        {formatDateTime(d.createdAt, locale)}
                      </p>
                    </div>
                    {canRevoke ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="text-destructive size-8 shrink-0"
                        aria-label={t("revoke")}
                        disabled={saving}
                        onClick={() => setRevokeId(d.id)}
                      >
                        <XCircle className="size-4" />
                      </Button>
                    ) : null}
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("addDelegation")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("fromUser")}</Label>
              <Select
                value={fromId || undefined}
                onValueChange={setFromId}
                disabled={!perms.canManageMeetings}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("pickUser")} />
                </SelectTrigger>
                <SelectContent>
                  {fromOptions.map((inv) => (
                    <SelectItem key={inv.userId} value={inv.userId}>
                      {inv.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!perms.canManageMeetings ? (
                <p className="text-muted-foreground text-xs">{t("selfOnlyHint")}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label>{t("toUser")}</Label>
              <Select
                value={toId || undefined}
                onValueChange={setToId}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("pickUser")} />
                </SelectTrigger>
                <SelectContent>
                  {toOptions.map((inv) => (
                    <SelectItem key={inv.userId} value={inv.userId}>
                      {inv.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("scope")}</Label>
              <RadioGroup
                value={scope}
                onValueChange={(v) => setScope(v as DelegationScope)}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ATTENDANCE_ONLY" id="scope-a" />
                  <Label htmlFor="scope-a" className="font-normal">
                    {t("scopeAttendanceOnly")}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="ATTENDANCE_AND_VOTING" id="scope-b" />
                  <Label htmlFor="scope-b" className="font-normal">
                    {t("scopeAttendanceVoting")}
                  </Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label htmlFor="deleg-auth">{t("authDoc")}</Label>
              <Input
                id="deleg-auth"
                type="file"
                onChange={(e) =>
                  setFile(e.target.files?.[0] ?? null)
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
              disabled={saving}
              onClick={() => void submitCreate()}
            >
              {saving ? <Spinner className="size-4" /> : tCommon("submit")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={revokeId != null}
        onOpenChange={(o) => !o && setRevokeId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("revokeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("revokeDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void revoke()}
            >
              {t("revoke")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
