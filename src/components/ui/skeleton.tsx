import clsx from "clsx";

/** 通用骨架屏脉冲动画组件 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "animate-pulse rounded-md bg-app-border-soft",
        className,
      )}
      aria-hidden="true"
    />
  );
}

/** 卡片骨架屏 */
export function CardSkeleton() {
  return (
    <div className="rounded-lg border border-app-border-soft bg-app-surface p-5 space-y-3">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-6 w-16 rounded-full" />
        <Skeleton className="h-6 w-12 rounded-full" />
      </div>
    </div>
  );
}

/** 列表页骨架屏 - 多卡片网格 */
export function ListSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}

/** 详情页骨架屏 */
export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* 标题区 */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3 flex-1">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-5 w-1/3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
        <Skeleton className="h-20 w-20 rounded-lg shrink-0" />
      </div>
      {/* Tab 导航 */}
      <div className="flex gap-1 border-b border-app-border-soft pb-0">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-t-md" />
        ))}
      </div>
      {/* 内容区 */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}

/** 仪表盘骨架屏 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* 概览卡片行 */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-app-border-soft bg-app-surface p-5 space-y-2">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-8 w-12" />
          </div>
        ))}
      </div>
      {/* 图表区 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-app-border-soft bg-app-surface p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
        <div className="rounded-lg border border-app-border-soft bg-app-surface p-5 space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-48 w-full rounded-md" />
        </div>
      </div>
    </div>
  );
}
