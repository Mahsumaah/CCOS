import { dashboardNavMetadata } from "@/lib/dashboard-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return dashboardNavMetadata(params, "quorumPolicies");
}

export default function QuorumPoliciesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
