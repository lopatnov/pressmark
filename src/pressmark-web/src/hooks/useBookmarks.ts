import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { feedClient } from '@/api/clients'
import { useCursorPaginatedList } from '@/hooks/useCursorPaginatedList'

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

  const fetchPage = useCallback(
    async (cursor: string, signal: AbortSignal) => {
      const res = await feedClient.getBookmarks(
        { pageSize: 20, cursor, subscriptionId: activeSubId },
        { signal },
      )
      return {
        items: res.items.map((item): BookmarkItem => ({
          id: item.id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          publishedAt: item.publishedAt,
          likeCount: item.likeCount,
          sourceTitle: item.sourceTitle,
          subscriptionId: item.subscriptionId,
          isSourceBanned: item.isSourceBanned,
        })),
        nextCursor: res.nextCursor,
      }
    },
    [activeSubId],
  )

  const { items, setItems, nextCursor, isLoading, sentinelRef, loadMore } = useCursorPaginatedList(
    fetchPage,
    activeSubId,
    true,
  )

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
    handleLoadMore: loadMore,
    removeBookmark,
  }
}
