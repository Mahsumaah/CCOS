"use client";

import type { MeetingType, QuorumRuleMode } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { MEETING_TYPES, getMeetingTypeLabel } from "@/lib/meeting-types";

type Row = {
  meetingType: MeetingType;
  quorumRequired: boolean;
  ruleMode: QuorumRuleMode;
  minAttendancePercent: number | null;
};

const RULE_MODES: QuorumRuleMode[] = [
  "ABSOLUTE_MAJORITY",
  "TWO_THIRDS",
  "MIN_PERCENT",
];

function ruleModeLabel(t: (key: string) => string, mode: QuorumRuleMode) {
  switch (mode) {
    case "ABSOLUTE_MAJORITY":
      return t("ruleAbsoluteMajority");
    case "TWO_THIRDS":
      return t("ruleTwoThirds");
    case "MIN_PERCENT":
      return t("ruleMinPercent");
    default:
      return mode;
  }
}

export function QuorumPoliciesForm({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("quorumPolicies");
  const tCommon = useTranslations("common");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<Row[]>(() =>
    MEETING_TYPES.map((meetingType) => ({
      meetingType,
      quorumRequired: true,
      ruleMode: "ABSOLUTE_MAJORITY" as QuorumRuleMode,
      minAttendancePercent: 50,
    })),
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/settings/meeting-quorum-policies", {
        credentials: "include",
      });
      if (!res.ok) {
        toast.error(t("loadError"));
        return;
      }
      const data = (await res.json()) as {
        policies: {
          meetingType: MeetingType;
          quorumRequired: boolean;
          ruleMode: QuorumRuleMode;
          minAttendancePercent: number | null;
        }[];
      };
      const byType = new Map(data.policies.map((p) => [p.meetingType, p]));
      setRows(
        MEETING_TYPES.map((meetingType) => {
          const p = byType.get(meetingType);
          return {
            meetingType,
            quorumRequired: p?.quorumRequired ?? true,
            ruleMode: p?.ruleMode ?? "ABSOLUTE_MAJORITY",
            minAttendancePercent:
              p?.ruleMode === "MIN_PERCENT"
                ? (p.minAttendancePercent ?? 50)
                : (p?.minAttendancePercent ?? 50),
          };
        }),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const updateRow = (meetingType: MeetingType, patch: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.meetingType === meetingType ? { ...r, ...patch } : r)),
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = rows.map((r) => ({
        meetingType: r.meetingType,
        quorumRequired: r.quorumRequired,
        ruleMode: r.ruleMode,
        minAttendancePercent:
          r.ruleMode === "MIN_PERCENT" ? (r.minAttendancePercent ?? 50) : null,
        optionsJson: null,
      }));
      const res = await fetch("/api/settings/meeting-quorum-policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        toast.error(t("saveError"));
        return;
      }
      toast.success(t("saved"));
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Skeleton className="h-4 w-full max-w-xl" />
          <Skeleton className="h-9 w-24" />
        </div>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("colType")}</TableHead>
                <TableHead>{t("colRequired")}</TableHead>
                <TableHead>{t("colRule")}</TableHead>
                <TableHead className="w-[140px]">{t("colMinPercent")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: MEETING_TYPES.length }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-6 w-10 rounded-full" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-9 w-[200px]" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-9 w-20" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-muted-foreground max-w-2xl text-sm">{t("intro")}</p>
        <Button type="button" disabled={saving} onClick={() => void save()}>
          {saving ? <Spinner className="size-4" /> : tCommon("save")}
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("colType")}</TableHead>
              <TableHead>{t("colRequired")}</TableHead>
              <TableHead>{t("colRule")}</TableHead>
              <TableHead className="w-[140px]">{t("colMinPercent")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.meetingType}>
                <TableCell className="font-medium">
                  {getMeetingTypeLabel(r.meetingType, locale)}
                </TableCell>
                <TableCell>
                  <Switch
                    checked={r.quorumRequired}
                    onCheckedChange={(v) =>
                      updateRow(r.meetingType, { quorumRequired: v })
                    }
                  />
                </TableCell>
                <TableCell>
                  <Select
                    value={r.ruleMode}
                    onValueChange={(v) =>
                      updateRow(r.meetingType, {
                        ruleMode: v as QuorumRuleMode,
                      })
                    }
                  >
                    <SelectTrigger className="w-[200px] max-w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {RULE_MODES.map((mode) => (
                        <SelectItem key={mode} value={mode}>
                          {ruleModeLabel(t, mode)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  {r.ruleMode === "MIN_PERCENT" ? (
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      className="w-full max-w-[120px]"
                      value={r.minAttendancePercent ?? 50}
                      onChange={(e) =>
                        updateRow(r.meetingType, {
                          minAttendancePercent: Number.parseInt(
                            e.target.value,
                            10,
                          ) || 50,
                        })
                      }
                    />
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
