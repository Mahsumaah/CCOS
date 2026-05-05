"use client";

import { Fragment } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Link } from "@/lib/i18n/routing";
import { cn } from "@/lib/utils";

export type DashboardCrumb = {
  label: string;
  href?: string;
};

export function DashboardBreadcrumbs({
  items,
  className,
}: {
  items: DashboardCrumb[];
  className?: string;
}) {
  return (
    <Breadcrumb className={cn("mb-4", className)}>
      <BreadcrumbList>
        {items.map((item, index) => (
          <Fragment key={`${index}-${item.label}`}>
            {index > 0 ? (
              <BreadcrumbSeparator className="rtl:rotate-180" />
            ) : null}
            <BreadcrumbItem>
              {item.href ? (
                <BreadcrumbLink asChild>
                  <Link href={item.href}>{item.label}</Link>
                </BreadcrumbLink>
              ) : (
                <BreadcrumbPage className="max-w-[min(70vw,28rem)] truncate">
                  {item.label}
                </BreadcrumbPage>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
