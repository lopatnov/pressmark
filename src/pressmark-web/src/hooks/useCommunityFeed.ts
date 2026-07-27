import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminClient, feedClient, subscriptionClient } from '@/api/clients'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useCursorPaginatedList } from '@/hooks/useCursorPaginatedList'

export interface CommunityItem {
  id: string
  title: string
  url: string
  summary: string
  publishedAt: string
  likeCount: number
  isLiked: boolean
  sourceTitle: string
  imageUrl: string
  subscriptionId: string
  sourceRssUrl: string
}

/**
 * Loads the community feed with cursor pagination and owns the actions available
 * on each item (like, subscribe, report, and the admin hide/ban moderation).
 *
 * @param activeSrcUrl RSS URL to filter by, or '' for the unfiltered feed.
 *   Changing it reloads from the first page and aborts the in-flight request.
 */
export function useCommunityFeed(activeSrcUrl: string) {
  const { t } = useTranslation(['feed', 'common', 'admin'])
  const { subscriptions, addSubscription } = useSubscriptionStore()

  const [reportedSubs, setReportedSubs] = useState<Set<string>>(new Set())
  const reportingSubsRef = useRef(new Set<string>())

  const subscribedUrls = useMemo(() => new Set(subscriptions.map((s) => s.rssUrl)), [subscriptions])

  const fetchPage = useCallback(
    async (cursor: string, signal: AbortSignal) => {
      const res = await feedClient.getCommunityFeed(
        { pageSize: 20, cursor, sourceRssUrl: activeSrcUrl },
        { signal },
      )
      return {
        items: res.items.map((item): CommunityItem => ({
          id: item.id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          publishedAt: item.publishedAt,
          likeCount: item.likeCount,
          isLiked: item.isLiked,
          sourceTitle: item.sourceTitle,
          imageUrl: item.imageUrl,
          subscriptionId: item.subscriptionId,
          sourceRssUrl: item.sourceRssUrl,
        })),
        nextCursor: res.nextCursor,
      }
    },
    [activeSrcUrl],
  )

  const { items, setItems, nextCursor, isLoading, sentinelRef, loadMore } = useCursorPaginatedList(
    fetchPage,
    activeSrcUrl,
  )

  const toggleLike = async (id: string) => {
    try {
      const res = await feedClient.toggleLike({ feedItemId: id })
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isLiked: res.isLiked, likeCount: res.likeCount } : item,
        ),
      )
    } catch {
      toast.error(t('common:error'))
    }
  }

  const hideItem = async (id: string) => {
    try {
      await adminClient.hideFeedItem({ feedItemId: id, hidden: true })
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success(t('admin:moderation.hidden'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  const subscribeToSource = async (rssUrl: string, title: string) => {
    const alreadyHave = subscriptions.some((s) => s.rssUrl === rssUrl)
    if (alreadyHave) {
      toast.info(t('feed:alreadySubscribed'))
      return
    }
    try {
      const res = await subscriptionClient.addSubscription({ rssUrl, title })
      addSubscription({
        id: res.id,
        rssUrl: res.rssUrl,
        title: res.title,
        lastFetchedAt: res.lastFetchedAt,
        createdAt: '',
        isCommunityBanned: false,
      })
      toast.success(t('feed:subscribeSuccess'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  const reportSource = async (subscriptionId: string) => {
    if (reportedSubs.has(subscriptionId) || reportingSubsRef.current.has(subscriptionId)) return
    reportingSubsRef.current.add(subscriptionId)
    try {
      await feedClient.reportContent({ type: 'subscription', targetId: subscriptionId, reason: '' })
      setReportedSubs((prev) => new Set(prev).add(subscriptionId))
      toast.success(t('feed:reportSent'))
    } catch {
      toast.error(t('feed:reportSubmitError'))
    } finally {
      reportingSubsRef.current.delete(subscriptionId)
    }
  }

  const banSource = async (subscriptionId: string) => {
    try {
      await adminClient.banSubscription({ subscriptionId, banned: true })
      setItems((prev) => prev.filter((item) => item.subscriptionId !== subscriptionId))
      toast.success(t('admin:moderation.banned'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  return {
    items,
    isLoading,
    nextCursor,
    sentinelRef,
    loadMore,
    subscribedUrls,
    reportedSubs,
    toggleLike,
    hideItem,
    subscribeToSource,
    reportSource,
    banSource,
  }
}
