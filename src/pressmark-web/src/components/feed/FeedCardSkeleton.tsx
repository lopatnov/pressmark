import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder shown in place of a FeedItemCard while the first page loads. */
export function FeedCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-3.5 w-3.5 rounded-sm" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-32" />
      </div>
      <Skeleton className="h-3 w-full" />
      <Skeleton className="h-3 w-5/6" />
    </div>
  )
}

const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3', 'sk-4', 'sk-5'] as const

/** A full first page of feed placeholders. */
export function FeedCardSkeletonList() {
  return (
    <>
      {SKELETON_KEYS.map((key) => (
        <FeedCardSkeleton key={key} />
      ))}
    </>
  )
}
