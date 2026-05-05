"use client";

import * as React from "react";
import Image from "next/image";
import { signOut } from "next-auth/react";
import {
  Bell,
  Briefcase,
  CalendarDays,
  LayoutDashboard,
  LogOut,
  Scale,
  Settings,
  UserCircle,
  Users,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { CcosLogo } from "@/components/brand/ccos-logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { QuorumWidget } from "@/components/layout/QuorumWidget";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { getRoleLabel, sidebarRoleBadgeClassName } from "@/lib/board-roles";
import { Link, usePathname, useRouter } from "@/lib/i18n/routing";
import { usePermissions } from "@/lib/permissions-context";
import { cn } from "@/lib/utils";
import type { BoardRole, Plan } from "@prisma/client";
import type { QuorumDTO } from "@/lib/meeting-quorum";
import { TrialBanner } from "@/components/trial/trial-banner";
import { TrialExpiredOverlay } from "@/components/trial/trial-expired-overlay";

export type DashboardShellUser = {
  name: string | null;
  email: string | null;
  role: BoardRole;
  tenantName: string | null;
  tenantLogo: string | null;
  canManageTenantSettings: boolean;
  tenantPlan: Plan;
  trialEndsAtIso: string | null;
};

export function DashboardShell({
  children,
  locale,
  user,
  liveQuorum,
}: {
  children: React.ReactNode;
  locale: "ar" | "en";
  user: DashboardShellUser;
  liveQuorum: {
    meetingId: string;
    title: string;
    quorum: QuorumDTO;
  } | null;
}) {
  const tNav = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tNotifications = useTranslations("notifications");
  const tPlan = useTranslations("planUpgrade");
  const pathname = usePathname();
  const router = useRouter();
  const sidebarSide = locale === "ar" ? "right" : "left";
  const perms = usePermissions();

  const nonEnterprisePlanTag =
    user.tenantPlan === "TRIAL"
      ? tPlan("planTagTrial")
      : user.tenantPlan === "STARTER"
        ? tPlan("planTagStarter")
        : user.tenantPlan === "PROFESSIONAL"
          ? tPlan("planTagProfessional")
          : null;

  const [unreadCount, setUnreadCount] = React.useState(0);
  const prevUnreadRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    async function fetchCount() {
      try {
        const res = await fetch("/api/notifications/count", {
          credentials: "include",
        });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { count?: number };
        if (!cancelled && typeof data.count === "number") {
          const next = data.count;
          const prev = prevUnreadRef.current;
          if (prev !== null && next > prev) {
            toast(tNotifications("newNotificationToast"), {
              action: {
                label: tNotifications("viewNotificationsAction"),
                onClick: () => {
                  router.push("/notifications");
                },
              },
            });
          }
          prevUnreadRef.current = next;
          setUnreadCount(next);
        }
      } catch {
        /* ignore */
      }
    }
    void fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [pathname, router, tNotifications]);

  type NavItem = {
    href: string;
    labelKey:
      | "dashboard"
      | "meetings"
      | "notifications"
      | "users"
      | "positions"
      | "quorumPolicies"
      | "settings"
      | "account";
    icon: typeof LayoutDashboard;
  };

  const navItems = React.useMemo((): NavItem[] => {
    const core: NavItem[] = [
      { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
      { href: "/meetings", labelKey: "meetings", icon: CalendarDays },
      { href: "/notifications", labelKey: "notifications", icon: Bell },
    ];
    const optional: NavItem[] = [];
    if (perms.canManageUsers) {
      optional.push({ href: "/users", labelKey: "users", icon: Users });
    }
    if (perms.canManagePositions) {
      optional.push({
        href: "/settings/positions",
        labelKey: "positions",
        icon: Briefcase,
      });
      optional.push({
        href: "/settings/quorum-policies",
        labelKey: "quorumPolicies",
        icon: Scale,
      });
    }
    if (user.canManageTenantSettings) {
      optional.push({
        href: "/settings",
        labelKey: "settings",
        icon: Settings,
      });
    }
    const tail: NavItem[] = [
      { href: "/account", labelKey: "account", icon: UserCircle },
    ];
    return [...core, ...optional, ...tail];
  }, [
    perms.canManageUsers,
    perms.canManagePositions,
    user.canManageTenantSettings,
  ]);

  function isActive(href: string) {
    if (href === "/dashboard") {
      return pathname === "/dashboard";
    }
    if (href === "/settings") {
      return pathname === "/settings";
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  async function onLogout() {
    await signOut({ callbackUrl: `/${locale}/login` });
  }

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <TrialExpiredOverlay
        plan={user.tenantPlan}
        trialEndsAtIso={user.trialEndsAtIso}
        locale={locale}
      />
      <Sidebar
        collapsible="icon"
        side={sidebarSide}
        variant="sidebar"
        className="no-print border-sidebar-border text-sidebar-foreground"
      >
        <SidebarHeader className="border-b border-sidebar-border px-2 pb-4 pt-2">
          <Link
            href="/dashboard"
            className="focus-visible:ring-sidebar-ring flex flex-col items-center gap-1 rounded-lg p-1 outline-none focus-visible:ring-2"
          >
            {user.tenantLogo ? (
              <span className="relative mx-auto block h-14 w-[140px] shrink-0">
                <Image
                  src={user.tenantLogo}
                  alt=""
                  fill
                  className="object-contain object-center"
                  sizes="140px"
                  priority
                  unoptimized
                />
              </span>
            ) : (
              <CcosLogo maxHeight={56} className="block w-auto" priority />
            )}
            {user.tenantName ? (
              <span className="text-muted-foreground line-clamp-2 max-w-full px-1 text-center text-xs font-medium leading-tight">
                {user.tenantName}
              </span>
            ) : null}
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={tNav(item.labelKey)}
                          className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground [&>svg]:text-sidebar-foreground"
                        >
                          <Link href={item.href}>
                            <Icon className="size-4 shrink-0" />
                            <span>{tNav(item.labelKey)}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <QuorumWidget locale={locale} liveQuorum={liveQuorum} />
        </SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border pt-2">
          <div className="flex flex-col gap-3 px-2 py-1">
            {user.tenantPlan !== "ENTERPRISE" && nonEnterprisePlanTag ? (
              <div className="flex flex-wrap items-center gap-2 px-0.5">
                <Badge variant="outline" className="text-[10px] font-semibold uppercase">
                  {nonEnterprisePlanTag}
                </Badge>
                <Link
                  href="/pricing"
                  locale={locale}
                  className="text-primary text-xs font-medium underline-offset-4 hover:underline"
                >
                  {tPlan("upgradeLink")}
                </Link>
              </div>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.name ?? user.email ?? "—"}
              </p>
              <Badge
                variant={user.role === "VIEWER" ? "outline" : "secondary"}
                className={cn(
                  "mt-1 max-w-full truncate",
                  sidebarRoleBadgeClassName(user.role),
                )}
              >
                {getRoleLabel(user.role, locale)}
              </Badge>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-sidebar-foreground/90 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              onClick={onLogout}
            >
              <LogOut className="me-2 size-4" />
              {tCommon("logout")}
            </Button>
          </div>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>
      <SidebarInset>
        <header
          className={cn(
            "no-print flex h-(--header-height) shrink-0 items-center gap-3 border-b border-border px-4",
            "bg-background/95 supports-backdrop-filter:bg-background/80 backdrop-blur",
          )}
        >
          <SidebarTrigger className="-ms-1 flex shrink-0 text-foreground" />
          <div className="ms-auto flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="text-foreground shrink-0" />
            <div className="flex items-center rounded-md border border-border bg-muted/40 p-0.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 min-w-9 px-2 text-foreground hover:bg-background",
                  locale === "ar" &&
                    "bg-primary font-medium text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
                )}
                asChild
              >
                <Link href={pathname} locale="ar">
                  AR
                </Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 min-w-9 px-2 text-foreground hover:bg-background",
                  locale === "en" &&
                    "bg-primary font-medium text-primary-foreground shadow-sm hover:bg-primary/90 hover:text-primary-foreground",
                )}
                asChild
              >
                <Link href={pathname} locale="en">
                  EN
                </Link>
              </Button>
            </div>
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="relative text-foreground"
            >
              <Link href="/notifications" aria-label={tNav("notifications")}>
                <Bell className="size-5" />
                {unreadCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="absolute -inset-e-1 -top-1 min-w-5 rounded-full border-0 px-1 py-0 text-[10px] leading-5"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </Badge>
                ) : null}
              </Link>
            </Button>
          </div>
        </header>
        <div className="flex flex-1 flex-col overflow-auto">
          <div className="@container/main motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300 flex flex-1 flex-col gap-2 p-4 md:p-6">
            <TrialBanner
              plan={user.tenantPlan}
              trialEndsAtIso={user.trialEndsAtIso}
              locale={locale}
            />
            {children}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
