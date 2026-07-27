import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { BookMarked } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useBookmarks } from '@/hooks/useBookmarks'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { FeedCardList } from '@/components/feed/FeedCardList'
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

      <FeedCardList
        items={items}
        isLoading={isLoading}
        nextCursor={nextCursor}
        sentinelRef={sentinelRef}
        onLoadMore={handleLoadMore}
        emptyMessage={t('feed:empty')}
        renderItem={(item) => (
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
        )}
      />
    </div>
  )
}
