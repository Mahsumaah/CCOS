import type { Metadata } from "next";

import { MarketingFooter } from "@/components/marketing/footer";
import { MarketingNavbar } from "@/components/marketing/navbar";
import { resolveLocaleParam } from "@/lib/locale-params";

export async function generateMetadata({
  params,
}: {
  params?: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const locale = await resolveLocaleParam(params);
  if (locale === "ar") {
    return {
      title: "CCOS - منصة إدارة اجتماعات مجالس الإدارة",
      description:
        "منصة شاملة لإدارة اجتماعات مجلس الإدارة والتصويت والقرارات والمحاضر. العربية والإنجليزية. ابدأ مجاناً.",
      openGraph: {
        title: "CCOS",
        description: "منصة إدارة اجتماعات مجالس الإدارة",
        type: "website",
      },
    };
  }
  return {
    title: "CCOS - Board Meetings Management Platform",
    description:
      "All-in-one platform for managing board meetings, voting, decisions, and minutes. Arabic and English. Free to start.",
    openGraph: {
      title: "CCOS",
      description: "Board Meetings Management Platform",
      type: "website",
    },
  };
}

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-svh flex-col scroll-smooth bg-background">
      <MarketingNavbar />
      <main className="flex-1 pt-16">{children}</main>
      <MarketingFooter />
    </div>
  );
}
