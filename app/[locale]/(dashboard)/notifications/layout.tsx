import { dashboardNavMetadata } from "@/lib/dashboard-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return dashboardNavMetadata(params, "notifications");
}

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
