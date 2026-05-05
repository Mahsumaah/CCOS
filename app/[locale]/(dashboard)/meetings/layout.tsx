import { dashboardNavMetadata } from "@/lib/dashboard-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return dashboardNavMetadata(params, "meetings");
}

export default function MeetingsSectionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
