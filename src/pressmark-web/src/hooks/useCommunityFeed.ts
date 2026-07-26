import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminClient, feedClient, subscriptionClient } from '@/api/clients'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'

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

  const [items, setItems] = useState<CommunityItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [reportedSubs, setReportedSubs] = useState<Set<string>>(new Set())

  const subscribedUrls = useMemo(() => new Set(subscriptions.map((s) => s.rssUrl)), [subscriptions])

  const loadFeed = useCallback(
    async (cursor = '', signal?: AbortSignal) => {
      setIsLoading(true)
      try {
        const res = await feedClient.getCommunityFeed(
          { pageSize: 20, cursor, sourceRssUrl: activeSrcUrl },
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
          isLiked: item.isLiked,
          sourceTitle: item.sourceTitle,
          imageUrl: item.imageUrl,
          subscriptionId: item.subscriptionId,
          sourceRssUrl: item.sourceRssUrl,
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
    [t, activeSrcUrl],
  )

  const loadMore = useCallback(() => {
    if (!isLoading) loadFeed(nextCursor)
  }, [nextCursor, isLoading, loadFeed])

  const sentinelRef = useIntersectionLoader(loadMore, !!nextCursor && !isLoading)

  useEffect(() => {
    const controller = new AbortController()
    loadFeed('', controller.signal)
    return () => controller.abort()
  }, [activeSrcUrl, loadFeed])

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
    try {
      await feedClient.reportContent({ type: 'subscription', targetId: subscriptionId, reason: '' })
      setReportedSubs((prev) => new Set(prev).add(subscriptionId))
      toast.success(t('feed:reportSent'))
    } catch {
      toast.error(t('feed:reportSubmitError'))
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
