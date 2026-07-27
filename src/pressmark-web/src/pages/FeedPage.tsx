import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Ban, X } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useFeedPage } from '@/hooks/useFeedPage'
import { Button } from '@/components/ui/button'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { FeedItemActions } from '@/components/feed/FeedItemActions'
import { FeedCardSkeletonList } from '@/components/feed/FeedCardSkeleton'

export function FeedPage() {
  const { t } = useTranslation(['feed', 'common', 'subscriptions'])
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
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground ${isSourceBanned ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/40'}`}
        >
          <span className="flex flex-1 items-center gap-2">
            {t('feed:filterBySource')}:{' '}
            <span className="font-medium text-foreground">
              {items[0]?.sourceTitle ?? activeSub?.title}
            </span>
            {isSourceBanned && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                <Ban className="h-3 w-3" />
                {t('subscriptions:banned')}
              </span>
            )}
          </span>
          <button
            type="button"
            onClick={() => setSearchParams({})}
            className="cursor-pointer hover:text-foreground transition-colors"
            title={t('feed:clearFilter')}
            aria-label={t('feed:clearFilter')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
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
