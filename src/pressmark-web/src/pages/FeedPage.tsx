import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Heart, Bookmark, BookMarked } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { feedClient } from '@/api/clients'
import { useFeedStore } from '@/store/feedStore'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'

function FeedCardSkeleton() {
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

export function FeedPage() {
  const { t } = useTranslation(['feed', 'common'])
  const {
    items,
    nextCursor,
    totalUnread,
    isLoading,
    unreadOnly,
    setItems,
    appendItems,
    prependItem,
    setLoading,
    setFilter,
    updateLike,
    updateBookmark,
    markRead,
    reset,
  } = useFeedStore()

  const loadFeed = useCallback(
    async (cursor = '', signal?: AbortSignal) => {
      setLoading(true)
      try {
        const res = await feedClient.getFeed(
          {
            pageSize: 20,
            cursor,
            unreadOnly: useFeedStore.getState().unreadOnly,
            subscriptionId: '',
          },
          { signal },
        )
        if (signal?.aborted) return
        const mapped = res.items.map((item) => ({
          id: item.id,
          subscriptionId: item.subscriptionId,
          title: item.title,
          url: item.url,
          summary: item.summary,
          publishedAt: item.publishedAt,
          isRead: item.isRead,
          likeCount: item.likeCount,
          isLiked: item.isLiked,
          isBookmarked: item.isBookmarked,
          sourceTitle: item.sourceTitle,
          imageUrl: item.imageUrl,
        }))
        if (cursor) {
          appendItems(mapped, res.nextCursor)
        } else {
          setItems(mapped, res.nextCursor, res.totalUnread)
        }
      } catch {
        if (!signal?.aborted) toast.error(t('common:error'))
      } finally {
        if (!signal?.aborted) setLoading(false)
      }
    },
    [setLoading, appendItems, setItems, t],
  )

  const handleLoadMore = useCallback(() => {
    const cursor = useFeedStore.getState().nextCursor
    if (cursor && !useFeedStore.getState().isLoading) loadFeed(cursor)
  }, [loadFeed])

  const sentinelRef = useIntersectionLoader(handleLoadMore, !!nextCursor && !isLoading)

  // Reload when filter changes; abort the previous in-flight request
  useEffect(() => {
    const controller = new AbortController()
    reset()
    loadFeed('', controller.signal)
    return () => controller.abort()
  }, [unreadOnly, loadFeed, reset])

  // Real-time streaming: prepend new items as they arrive from the server
  useEffect(() => {
    const controller = new AbortController()

    const connect = async () => {
      try {
        const sinceTimestamp = useFeedStore.getState().items[0]?.publishedAt ?? ''
        const stream = feedClient.streamFeedUpdates(
          { sinceTimestamp },
          { signal: controller.signal },
        )
        for await (const item of stream) {
          prependItem({
            id: item.id,
            subscriptionId: item.subscriptionId,
            title: item.title,
            url: item.url,
            summary: item.summary,
            publishedAt: item.publishedAt,
            isRead: item.isRead,
            likeCount: item.likeCount,
            isLiked: item.isLiked,
            isBookmarked: item.isBookmarked,
            sourceTitle: item.sourceTitle,
            imageUrl: item.imageUrl,
          })
        }
      } catch {
        if (!controller.signal.aborted) setTimeout(connect, 5000)
      }
    }

    connect()
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleLike = async (id: string) => {
    const res = await feedClient.toggleLike({ feedItemId: id })
    updateLike(id, res.isLiked, res.likeCount)
  }

  const handleBookmark = async (id: string) => {
    const res = await feedClient.toggleBookmark({ feedItemId: id })
    updateBookmark(id, res.isBookmarked)
  }

  const handleRead = (id: string) => {
    markRead(id)
    feedClient.markAsRead({ feedItemId: id }).catch(() => {})
  }

  const handleMarkAllRead = async () => {
    await feedClient.markAllAsRead({ subscriptionId: '' })
    reset()
    loadFeed()
  }

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
              onChange={(e) => setFilter(e.target.checked, '')}
              className="h-3.5 w-3.5"
            />
            {t('feed:unreadOnly')}
          </label>
          {totalUnread > 0 && (
            <Button variant="ghost" size="sm" onClick={handleMarkAllRead}>
              {t('feed:markAllRead')}
            </Button>
          )}
        </div>
      </div>

      {items.length === 0 && !isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('feed:empty')}</p>
      )}

      <div className="space-y-2">
        {isLoading && items.length === 0
          ? Array.from({ length: 5 }).map((_, i) => <FeedCardSkeleton key={i} />)
          : items.map((item) => (
              <FeedItemCard
                key={item.id}
                item={item}
                articleId={item.id}
                onTitleClick={!item.isRead ? () => handleRead(item.id) : undefined}
                actions={
                  <>
                    <button
                      onClick={() => handleLike(item.id)}
                      title={item.isLiked ? t('feed:unlike') : t('feed:like')}
                      aria-label={item.isLiked ? t('feed:unlike') : t('feed:like')}
                      className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${item.isLiked ? 'text-rose-500' : 'text-muted-foreground'}`}
                    >
                      <Heart className={`h-3.5 w-3.5 ${item.isLiked ? 'fill-current' : ''}`} />
                      {item.likeCount > 0 && <span>{item.likeCount}</span>}
                    </button>
                    <button
                      onClick={() => handleBookmark(item.id)}
                      title={item.isBookmarked ? t('feed:removeBookmark') : t('feed:bookmark')}
                      aria-label={item.isBookmarked ? t('feed:removeBookmark') : t('feed:bookmark')}
                      className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${item.isBookmarked ? 'text-amber-500' : 'text-muted-foreground'}`}
                    >
                      {item.isBookmarked ? (
                        <BookMarked className="h-3.5 w-3.5 fill-current" />
                      ) : (
                        <Bookmark className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </>
                }
              />
            ))}
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
