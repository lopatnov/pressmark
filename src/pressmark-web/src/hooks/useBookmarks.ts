import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { feedClient } from '@/api/clients'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'

export interface BookmarkItem {
  id: string
  title: string
  url: string
  summary: string
  publishedAt: string
  likeCount: number
  sourceTitle: string
  subscriptionId: string
  isSourceBanned: boolean
}

/**
 * Loads the bookmarked articles with cursor pagination and owns the un-bookmark
 * action, leaving BookmarksPage with layout only.
 *
 * @param activeSubId Subscription to filter by, or '' for all subscriptions.
 *   Changing it reloads from the first page and aborts the in-flight request.
 */
export function useBookmarks(activeSubId: string) {
  const { t } = useTranslation(['feed', 'common'])

  const [items, setItems] = useState<BookmarkItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadBookmarks = useCallback(
    async (cursor = '', signal?: AbortSignal) => {
      setIsLoading(true)
      try {
        const res = await feedClient.getBookmarks(
          { pageSize: 20, cursor, subscriptionId: activeSubId },
          { signal },
        )
        if (signal?.aborted) return
        const mapped = res.items.map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          publishedAt: item.publishedAt,
          likeCount: item.likeCount,
          sourceTitle: item.sourceTitle,
          subscriptionId: item.subscriptionId,
          isSourceBanned: item.isSourceBanned,
        }))
        if (cursor) {
          setItems((prev) => [...prev, ...mapped])
        } else {
          setItems(mapped)
        }
        setNextCursor(res.nextCursor)
      } catch {
        if (!signal?.aborted) toast.error(t('common:error'))
      } finally {
        // An aborted request must not clear the flag the request that replaced
        // it has already set, or the skeleton drops and loadMore refires early.
        if (!signal?.aborted) setIsLoading(false)
      }
    },
    [t, activeSubId],
  )

  const handleLoadMore = useCallback(() => {
    if (!isLoading) loadBookmarks(nextCursor)
  }, [nextCursor, isLoading, loadBookmarks])

  const sentinelRef = useIntersectionLoader(handleLoadMore, !!nextCursor && !isLoading)

  // Reload when the source filter changes; abort the previous in-flight request
  useEffect(() => {
    const controller = new AbortController()
    setItems([])
    setNextCursor('')
    loadBookmarks('', controller.signal)
    return () => controller.abort()
  }, [activeSubId, loadBookmarks])

  /** The row disappears on success; a failure leaves the list untouched. */
  const removeBookmark = async (id: string) => {
    try {
      await feedClient.toggleBookmark({ feedItemId: id })
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch {
      toast.error(t('common:error'))
    }
  }

  return {
    items,
    nextCursor,
    isLoading,
    sentinelRef,
    handleLoadMore,
    removeBookmark,
  }
}
