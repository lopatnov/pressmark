import type { ReactNode, RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FeedCardSkeletonList } from '@/components/feed/FeedCardSkeleton'

interface FeedCardListProps<TItem> {
  items: TItem[]
  isLoading: boolean
  nextCursor: string
  sentinelRef: RefObject<HTMLDivElement | null>
  onLoadMore: () => void
  /** Shown when the list is empty and done loading. Omit (or pass a falsy value) to suppress it. */
  emptyMessage?: ReactNode
  renderItem: (item: TItem) => ReactNode
}

/**
 * Shared shape for the feed/community/bookmarks lists: empty state, skeleton
 * on first load, the item list, an infinite-scroll sentinel with a load-more
 * fallback button, and a "loading more" footer. Each caller keeps its own
 * header, filters and per-item actions — this only owns the part that was
 * identical across FeedPage/CommunityPage/BookmarksPage.
 */
export function FeedCardList<TItem>({
  items,
  isLoading,
  nextCursor,
  sentinelRef,
  onLoadMore,
  emptyMessage,
  renderItem,
}: FeedCardListProps<TItem>) {
  const { t } = useTranslation()

  return (
    <>
      {emptyMessage && items.length === 0 && !isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>
      )}

      <div className="space-y-2">
        {isLoading && items.length === 0 ? <FeedCardSkeletonList /> : items.map(renderItem)}
      </div>

      {nextCursor && (
        <div ref={sentinelRef} className="pt-2 text-center">
          <Button variant="outline" disabled={isLoading} onClick={onLoadMore}>
            {t('feed:loadMore')}
          </Button>
        </div>
      )}

      {isLoading && items.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">{t('common:loading')}</p>
      )}
    </>
  )
}
