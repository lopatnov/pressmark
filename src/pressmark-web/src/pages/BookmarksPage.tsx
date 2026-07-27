import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookMarked } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useBookmarks } from '@/hooks/useBookmarks'
import { Button } from '@/components/ui/button'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { FeedCardSkeletonList } from '@/components/feed/FeedCardSkeleton'
import { SourceFilterBanner } from '@/components/feed/SourceFilterBanner'

export function BookmarksPage() {
  const { t } = useTranslation(['feed', 'common'])
  usePageTitle(t('common:nav.bookmarks'))
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSubId = searchParams.get('sub') ?? ''

  const { items, nextCursor, isLoading, sentinelRef, handleLoadMore, removeBookmark } =
    useBookmarks(activeSubId)

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{t('common:nav.bookmarks')}</h1>

      {activeSubId && items.length > 0 && (
        <SourceFilterBanner
          sourceTitle={items[0].sourceTitle}
          isBanned={items[0].isSourceBanned}
          onClear={() => setSearchParams({})}
        />
      )}

      {items.length === 0 && !isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('feed:empty')}</p>
      )}

      <div className="space-y-2">
        {isLoading && items.length === 0 ? (
          <FeedCardSkeletonList />
        ) : (
          items.map((item) => (
            <FeedItemCard
              key={item.id}
              item={item}
              articleId={item.id}
              sourceHref={item.subscriptionId ? `/bookmarks?sub=${item.subscriptionId}` : undefined}
              actions={
                <button
                  type="button"
                  onClick={() => removeBookmark(item.id)}
                  title={t('feed:removeBookmark')}
                  aria-label={t('feed:removeBookmark')}
                  className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-amber-500 transition-colors hover:bg-muted"
                >
                  <BookMarked className="h-3.5 w-3.5 fill-current" />
                  <span>{t('feed:removeBookmark')}</span>
                </button>
              }
            />
          ))
        )}
      </div>

      {nextCursor && (
        <div ref={sentinelRef} className="pt-2 text-center">
          <Button variant="outline" disabled={isLoading} onClick={handleLoadMore}>
            {t('feed:loadMore')}
          </Button>
        </div>
      )}

      {isLoading && items.length > 0 && (
        <p className="text-center text-sm text-muted-foreground">{t('common:loading')}</p>
      )}
    </div>
  )
}
