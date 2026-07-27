import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useFeedPage } from '@/hooks/useFeedPage'
import { Button } from '@/components/ui/button'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { FeedItemActions } from '@/components/feed/FeedItemActions'
import { FeedCardList } from '@/components/feed/FeedCardList'
import { SourceFilterBanner } from '@/components/feed/SourceFilterBanner'

export function FeedPage() {
  const { t } = useTranslation(['feed', 'common'])
  usePageTitle(t('common:nav.feed'))
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSubId = searchParams.get('sub') ?? ''
  const activeSub = useSubscriptionStore((s) =>
    s.subscriptions.find((sub) => sub.id === activeSubId),
  )

  const {
    items,
    nextCursor,
    totalUnread,
    isLoading,
    unreadOnly,
    setUnreadOnly,
    sentinelRef,
    handleLoadMore,
    toggleLike,
    toggleBookmark,
    markAsRead,
    markAllRead,
  } = useFeedPage(activeSubId)

  const isSourceBanned = items[0]?.isSourceBanned ?? activeSub?.isCommunityBanned

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-semibold">{t('feed:title')}</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-primary-foreground">
              {t('feed:unreadCount', { count: totalUnread })}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={unreadOnly}
              onChange={(e) => setUnreadOnly(e.target.checked)}
              className="h-3.5 w-3.5"
            />
            {t('feed:unreadOnly')}
          </label>
          {totalUnread > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              {t('feed:markAllRead')}
            </Button>
          )}
        </div>
      </div>

      {activeSubId && (items.length > 0 || activeSub) && (
        <SourceFilterBanner
          sourceTitle={items[0]?.sourceTitle ?? activeSub?.title}
          isBanned={isSourceBanned}
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
            sourceHref={item.subscriptionId ? `/feed?sub=${item.subscriptionId}` : undefined}
            onTitleClick={!item.isRead ? () => markAsRead(item.id) : undefined}
            actions={
              <FeedItemActions
                id={item.id}
                isLiked={item.isLiked}
                likeCount={item.likeCount}
                isBookmarked={item.isBookmarked}
                onLike={toggleLike}
                onBookmark={toggleBookmark}
              />
            }
          />
        )}
      />
    </div>
  )
}
