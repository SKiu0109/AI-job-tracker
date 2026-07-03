import { ListSkeleton } from "@/components/ui/skeleton";

export default function WorkspaceLoading() {
  return (
    <div className="space-y-6">
      {/* 搜索/过滤栏骨架 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="h-10 w-64 animate-pulse rounded-md bg-app-border-soft" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-app-border-soft" />
        <div className="h-10 w-32 animate-pulse rounded-md bg-app-border-soft" />
      </div>
      <ListSkeleton count={6} />
    </div>
  );
}
