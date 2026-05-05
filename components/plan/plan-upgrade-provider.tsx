"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link } from "@/lib/i18n/routing";
import {
  planLimitMessageFromBody,
  type PlanLimitApiBody,
} from "@/lib/plan-limits-config";

type Ctx = {
  showPlanUpgrade: (message: string) => void;
  showPlanUpgradeFromApiBody: (body: PlanLimitApiBody, locale: "ar" | "en") => void;
};

const PlanUpgradeContext = React.createContext<Ctx | null>(null);

export function usePlanUpgrade(): Ctx {
  const v = React.useContext(PlanUpgradeContext);
  if (!v) {
    return {
      showPlanUpgrade: () => {},
      showPlanUpgradeFromApiBody: () => {},
    };
  }
  return v;
}

export function PlanUpgradeProvider({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: "ar" | "en";
}) {
  const t = useTranslations("planUpgrade");
  const [open, setOpen] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const showPlanUpgrade = React.useCallback((msg: string) => {
    setMessage(msg);
    setOpen(true);
  }, []);

  const showPlanUpgradeFromApiBody = React.useCallback(
    (body: PlanLimitApiBody, loc: "ar" | "en") => {
      const msg = planLimitMessageFromBody(body, loc);
      if (msg) showPlanUpgrade(msg);
    },
    [showPlanUpgrade],
  );

  const value = React.useMemo(
    () => ({ showPlanUpgrade, showPlanUpgradeFromApiBody }),
    [showPlanUpgrade, showPlanUpgradeFromApiBody],
  );

  return (
    <PlanUpgradeContext.Provider value={value}>
      {children}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription className="text-start">
              {message}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              {t("later")}
            </Button>
            <Button type="button" asChild>
              <Link href="/pricing" locale={locale}>
                {t("upgradeCta")}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlanUpgradeContext.Provider>
  );
}
