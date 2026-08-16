import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { feedClient } from '@/api/clients'
import type { FeedItem as FeedItemMessage } from '@/api/generated/feed_pb'
import { useFeedStore, type FeedItem } from '@/store/feedStore'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'
import { useLatestRequest } from '@/hooks/useLatestRequest'

/**
 * Projects a wire feed item onto the store's shape. Shared by the paged load and
 * the update stream so a new proto field can only ever be wired into both at once.
 */
function toFeedItem(item: FeedItemMessage): FeedItem {
  return {
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
    isSourceBanned: item.isSourceBanned,
  }
}

/**
 * Drives the personal feed: the paginated load, the live update stream and the
 * per-item actions, leaving FeedPage with layout only.
 *
 * @param activeSubId Subscription to filter by, or '' for all subscriptions.
 *   Changing it (or the unread filter) resets the list and aborts the in-flight
 *   request.
 */
export function useFeedPage(activeSubId: string) {
  const { t } = useTranslation(['feed', 'common', 'subscriptions'])
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
    setUnreadOnly,
    updateLike,
    updateBookmark,
    markRead,
    reset,
  } = useFeedStore()

  // Shared across load-more and the reset effect so either one starting a fresh
  // request aborts whichever request the other one has in flight. The signal is
  // required rather than optional: an unabortable load-more was how a page of
  // the previous filter used to append itself to the list that replaced it.
  const { start, abort } = useLatestRequest()

  const loadFeed = useCallback(
    async (cursor: string, signal: AbortSignal) => {
      setLoading(true)
      try {
        const res = await feedClient.getFeed(
          {
            pageSize: 20,
            cursor,
            unreadOnly: useFeedStore.getState().unreadOnly,
            subscriptionId: activeSubId,
          },
          { signal },
        )
        if (signal.aborted) return
        const mapped = res.items.map(toFeedItem)
        if (cursor) {
          appendItems(mapped, res.nextCursor)
        } else {
          setItems(mapped, res.nextCursor, res.totalUnread)
        }
      } catch {
        if (!signal.aborted) toast.error(t('common:error'))
      } finally {
        // An aborted request must not clear the flag the request that replaced
        // it has already set, or the skeleton drops and load-more refires early.
        if (!signal.aborted) setLoading(false)
      }
    },
    [setLoading, appendItems, setItems, t, activeSubId],
  )

  const startLoad = useCallback(
    (cursor: string) => start((signal) => loadFeed(cursor, signal)),
    [start, loadFeed],
  )

  const handleLoadMore = useCallback(() => {
    const { nextCursor: cursor, isLoading: loading } = useFeedStore.getState()
    if (cursor && !loading) startLoad(cursor)
  }, [startLoad])

  const sentinelRef = useIntersectionLoader(handleLoadMore, !!nextCursor && !isLoading)

  // Reload when filter changes; abort the previous in-flight request
  useEffect(() => {
    reset()
    startLoad('')
    return abort
  }, [unreadOnly, activeSubId, startLoad, reset, abort])

  // The stream outlives filter changes, so the active filter is read through a
  // ref instead of being captured in the connection's closure.
  const activeSubIdRef = useRef(activeSubId)
  useEffect(() => {
    activeSubIdRef.current = activeSubId
  }, [activeSubId])

  // Real-time streaming: prepend new items as they arrive from the server,
  // reconnecting after a 5s backoff whenever the stream drops.
  useEffect(() => {
    const controller = new AbortController()
    let retryTimer: ReturnType<typeof setTimeout> | undefined

    const connect = async () => {
      try {
        const sinceTimestamp = useFeedStore.getState().items[0]?.publishedAt ?? ''
        const stream = feedClient.streamFeedUpdates(
          { sinceTimestamp },
          { signal: controller.signal },
        )
        for await (const item of stream) {
          // While a source filter is active the list must only ever show that
          // source; updates from other subscriptions are dropped.
          const filterSubId = activeSubIdRef.current
          if (filterSubId && item.subscriptionId !== filterSubId) continue
          prependItem(toFeedItem(item))
        }
      } catch {
        if (!controller.signal.aborted) retryTimer = setTimeout(connect, 5000)
      }
    }

    connect()
    return () => {
      controller.abort()
      if (retryTimer) clearTimeout(retryTimer)
    }
  }, [])

  const toggleLike = async (id: string) => {
    try {
      const res = await feedClient.toggleLike({ feedItemId: id })
      updateLike(id, res.isLiked, res.likeCount)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const toggleBookmark = async (id: string) => {
    try {
      const res = await feedClient.toggleBookmark({ feedItemId: id })
      updateBookmark(id, res.isBookmarked)
    } catch {
      toast.error(t('common:error'))
    }
  }

  /** Optimistic: the item greys out immediately, the write is fire-and-forget. */
  const markAsRead = (id: string) => {
    markRead(id)
    feedClient.markAsRead({ feedItemId: id }).catch(() => {})
  }

  const markAllRead = async () => {
    try {
      await feedClient.markAllAsRead({ subscriptionId: activeSubId })
      reset()
      startLoad('')
    } catch {
      toast.error(t('common:error'))
    }
  }

  return {
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
  }
}
