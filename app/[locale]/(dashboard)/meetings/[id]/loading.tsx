import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function MeetingDetailLoading() {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8 pb-12">
      <Skeleton className="h-10 w-full max-w-md" />
      <div className="space-y-3">
        <Skeleton className="h-10 w-3/4 max-w-lg" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-xl" />
      <Card className="shadow-sm">
        <CardContent className="space-y-4 p-6">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </CardContent>
      </Card>
    </div>
  );
}
