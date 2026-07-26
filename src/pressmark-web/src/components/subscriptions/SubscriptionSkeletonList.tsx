import { Skeleton } from '@/components/ui/skeleton'

const SKELETON_KEYS = ['sk-1', 'sk-2', 'sk-3'] as const

export function SubscriptionSkeletonList() {
  return (
    <div className="space-y-2">
      {SKELETON_KEYS.map((key) => (
        <div
          key={key}
          className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
        >
          <div className="space-y-1.5 flex-1 min-w-0">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-64" />
          </div>
          <Skeleton className="h-7 w-16 ml-2" />
        </div>
      ))}
    </div>
  )
}
