import { dashboardNavMetadata } from "@/lib/dashboard-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return dashboardNavMetadata(params, "settings");
}

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
