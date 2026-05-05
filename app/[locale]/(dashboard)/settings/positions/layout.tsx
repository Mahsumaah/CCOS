import { dashboardNavMetadata } from "@/lib/dashboard-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return dashboardNavMetadata(params, "positions");
}

export default function PositionsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
