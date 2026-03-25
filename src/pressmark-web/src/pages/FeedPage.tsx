import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart, Bookmark, BookMarked, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { feedClient } from '@/api/clients'
import { useFeedStore } from '@/store/feedStore'

export function FeedPage() {
  const { t } = useTranslation(['feed', 'common'])
  const {
    items, nextCursor, totalUnread, isLoading, unreadOnly,
    setItems, appendItems, prependItem, setLoading, setFilter, updateLike,
    updateBookmark, markRead, reset,
  } = useFeedStore()

  const loadFeed = async (cursor = '') => {
    setLoading(true)
    try {
      const res = await feedClient.getFeed({
        pageSize: 20,
        cursor,
        unreadOnly,
        subscriptionId: '',
      })
      const mapped = res.items.map((item) => ({
        id:             item.id,
        subscriptionId: item.subscriptionId,
        title:          item.title,
        url:            item.url,
        summary:        item.summary,
        publishedAt:    item.publishedAt,
        isRead:         item.isRead,
        likeCount:      item.likeCount,
        isLiked:        item.isLiked,
        isBookmarked:   item.isBookmarked,
        sourceTitle:    item.sourceTitle,
        imageUrl:       item.imageUrl,
      }))
      if (cursor) {
        appendItems(mapped, res.nextCursor)
      } else {
        setItems(mapped, res.nextCursor, res.totalUnread)
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    reset()
    loadFeed()
  }, [unreadOnly])

  // Real-time streaming: prepend new items as they arrive from the server
  useEffect(() => {
    let active = true

    const connect = async () => {
      try {
        const sinceTimestamp = useFeedStore.getState().items[0]?.publishedAt ?? ''
        const stream = feedClient.streamFeedUpdates({ sinceTimestamp })
        for await (const item of stream) {
          if (!active) break
          prependItem({
            id:             item.id,
            subscriptionId: item.subscriptionId,
            title:          item.title,
            url:            item.url,
            summary:        item.summary,
            publishedAt:    item.publishedAt,
            isRead:         item.isRead,
            likeCount:      item.likeCount,
            isLiked:        item.isLiked,
            isBookmarked:   item.isBookmarked,
            sourceTitle:    item.sourceTitle,
            imageUrl:       item.imageUrl,
          })
        }
      } catch {
        if (active) setTimeout(connect, 5000)
      }
    }

    connect()
    return () => { active = false }
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
        {items.map((item) => (
          <article
            key={item.id}
            className={`rounded-lg border bg-card p-4 space-y-1.5 ${!item.isRead ? 'border-l-2 border-l-primary border-border' : 'border-border'}`}
          >
            <div className="flex items-start justify-between gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => !item.isRead && handleRead(item.id)}
                className={`text-sm font-medium leading-snug hover:underline ${!item.isRead ? 'text-foreground' : 'text-muted-foreground'}`}
              >
                {item.title}
              </a>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.sourceTitle && <span className="font-medium">{item.sourceTitle}</span>}
              {item.sourceTitle && <span>·</span>}
              <span>
                {item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ''}
              </span>
            </div>

            {item.summary && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{item.summary}</p>
            )}

            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={() => handleLike(item.id)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${item.isLiked ? 'text-rose-500' : 'text-muted-foreground'}`}
              >
                <Heart className={`h-3.5 w-3.5 ${item.isLiked ? 'fill-current' : ''}`} />
                {item.likeCount > 0 && <span>{item.likeCount}</span>}
              </button>
              <button
                onClick={() => handleBookmark(item.id)}
                className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${item.isBookmarked ? 'text-amber-500' : 'text-muted-foreground'}`}
              >
                {item.isBookmarked
                  ? <BookMarked className="h-3.5 w-3.5 fill-current" />
                  : <Bookmark className="h-3.5 w-3.5" />
                }
              </button>
            </div>
          </article>
        ))}
      </div>

      {nextCursor && (
        <div className="pt-2 text-center">
          <Button variant="outline" disabled={isLoading} onClick={() => loadFeed(nextCursor)}>
            {t('feed:loadMore')}
          </Button>
        </div>
      )}

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground">{t('common:loading')}</p>
      )}
    </div>
  )
}
