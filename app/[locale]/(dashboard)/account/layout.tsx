import { dashboardNavMetadata } from "@/lib/dashboard-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return dashboardNavMetadata(params, "account");
}

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
