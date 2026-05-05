import { dashboardMetadataFromKey } from "@/lib/dashboard-metadata";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  return dashboardMetadataFromKey(params, "meetings", "createTitle");
}

export default function NewMeetingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
