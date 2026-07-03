import { CardSkeleton } from "@/components/ui/skeleton";

export default function ResumeHubLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
