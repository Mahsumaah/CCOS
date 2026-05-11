"use client";

import type { AuditAction } from "@prisma/client";
import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";

type AuditRow = {
  id: string;
  action: AuditAction;
  createdAt: string;
  targetType: string;
  actor: { id: string; name: string; role: string } | null;
};

export function LiveAuditLogPanel({
  meetingId,
  locale,
}: {
  meetingId: string;
  locale: "ar" | "en";
}) {
  const t = useTranslations("meetings.liveAudit");
  const tCommon = useTranslations("common");
  const [logs, setLogs] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}/live/audit`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = (await res.json()) as { logs: AuditRow[] };
        setLogs(data.logs ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner className="size-4" />
            {tCommon("loading")}
          </div>
        ) : logs.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t("empty")}</p>
        ) : (
          <div className="max-h-[360px] w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columnTime")}</TableHead>
                  <TableHead>{t("columnAction")}</TableHead>
                  <TableHead>{t("columnActor")}</TableHead>
                  <TableHead>{t("columnTarget")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap text-xs">
                      {formatDateTime(log.createdAt, locale)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.action}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {log.actor?.name ?? t("systemActor")}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {log.targetType}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
