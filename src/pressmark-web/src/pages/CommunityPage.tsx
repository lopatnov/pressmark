import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Heart, EyeOff, Ban, Rss, Check, Flag, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient, feedClient, subscriptionClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'
import { useSubscriptionStore } from '@/store/subscriptionStore'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { CommentSection } from '@/components/feed/CommentSection'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'

interface CommunityItem {
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

export function CommunityPage() {
  const { t } = useTranslation(['feed', 'common', 'admin'])
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSrcUrl = searchParams.get('src') ?? ''
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin = useAuthStore((s) => s.isAdmin())
  const registrationMode = useAuthStore((s) => s.registrationMode)
  const communityWindowDays = useAuthStore((s) => s.communityWindowDays)
  const { subscriptions, addSubscription } = useSubscriptionStore()

  const [items, setItems] = useState<CommunityItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const subscribedUrls = useMemo(() => new Set(subscriptions.map((s) => s.rssUrl)), [subscriptions])
  const [reportedSubs, setReportedSubs] = useState<Set<string>>(new Set())

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
        setIsLoading(false)
      }
    },
    [t, activeSrcUrl],
  )

  const handleLoadMore = useCallback(() => {
    if (!isLoading) loadFeed(nextCursor)
  }, [nextCursor, isLoading, loadFeed])

  const sentinelRef = useIntersectionLoader(handleLoadMore, !!nextCursor && !isLoading)

  const handleLike = async (id: string) => {
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

  const handleHide = async (id: string) => {
    try {
      await adminClient.hideFeedItem({ feedItemId: id, hidden: true })
      setItems((prev) => prev.filter((item) => item.id !== id))
      toast.success(t('admin:moderation.hidden'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleSubscribe = async (rssUrl: string, title: string) => {
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
      })
      toast.success(t('feed:subscribeSuccess'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleReportSource = async (subscriptionId: string) => {
    try {
      await feedClient.reportContent({ type: 'subscription', targetId: subscriptionId, reason: '' })
      setReportedSubs((prev) => new Set(prev).add(subscriptionId))
      toast.success(t('feed:reportSent'))
    } catch {
      toast.error(t('feed:reportSubmitError'))
    }
  }

  const handleBanSubscription = async (subscriptionId: string) => {
    try {
      await adminClient.banSubscription({ subscriptionId, banned: true })
      setItems((prev) => prev.filter((item) => item.subscriptionId !== subscriptionId))
      toast.success(t('admin:moderation.banned'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    loadFeed('', controller.signal)
    return () => controller.abort()
  }, [activeSrcUrl, loadFeed])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('feed:community.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('feed:community.subtitle', { count: communityWindowDays, days: communityWindowDays })}
        </p>
      </div>

      {!isAuthenticated && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t('feed:community.empty')}{' '}
          <Link to="/login" className="underline">
            {t('common:nav.login')}
          </Link>
          {registrationMode === 'open' && (
            <>
              {' '}
              &middot;{' '}
              <Link to="/register" className="underline">
                {t('common:nav.register')}
              </Link>
            </>
          )}
        </p>
      )}

      {activeSrcUrl && items.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <span className="flex-1">
            {t('feed:filterBySource')}:{' '}
            <span className="font-medium text-foreground">{items[0].sourceTitle}</span>
          </span>
          <button
            onClick={() => setSearchParams({})}
            className="cursor-pointer hover:text-foreground transition-colors"
            title={t('feed:clearFilter')}
            aria-label={t('feed:clearFilter')}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {items.length === 0 && !isLoading && isAuthenticated && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('feed:community.empty')}
        </p>
      )}

      <div className="space-y-2">
        {isLoading && items.length === 0
          ? Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-4 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <div className="flex gap-2">
                  <Skeleton className="h-3.5 w-3.5 rounded-sm" />
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-5/6" />
              </div>
            ))
          : items.map((item) => (
              <FeedItemCard
                key={item.id}
                item={item}
                articleId={item.id}
                sourceHref={
                  item.sourceRssUrl ? `/?src=${encodeURIComponent(item.sourceRssUrl)}` : undefined
                }
                actions={
                  <div className="flex items-center gap-1 flex-wrap">
                    {isAuthenticated ? (
                      <button
                        onClick={() => handleLike(item.id)}
                        title={item.isLiked ? t('feed:unlike') : t('feed:like')}
                        aria-label={item.isLiked ? t('feed:unlike') : t('feed:like')}
                        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${item.isLiked ? 'text-rose-500' : 'text-muted-foreground'}`}
                      >
                        <Heart className={`h-3.5 w-3.5 ${item.isLiked ? 'fill-current' : ''}`} />
                        {item.likeCount > 0 && <span>{item.likeCount}</span>}
                      </button>
                    ) : (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                        <Heart className="h-3.5 w-3.5" />
                        {item.likeCount > 0 && <span>{item.likeCount}</span>}
                      </span>
                    )}
                    {item.sourceRssUrl && !subscribedUrls.has(item.sourceRssUrl) && (
                      <button
                        onClick={() => handleSubscribe(item.sourceRssUrl, item.sourceTitle)}
                        title={t('feed:subscribe')}
                        aria-label={t('feed:subscribe')}
                        className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Rss className="h-3.5 w-3.5" />
                        <span>{t('feed:subscribe')}</span>
                      </button>
                    )}
                    {item.sourceRssUrl && subscribedUrls.has(item.sourceRssUrl) && (
                      <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                        <Check className="h-3.5 w-3.5" />
                        <span>{t('feed:subscribed')}</span>
                      </span>
                    )}
                    {isAuthenticated &&
                      !isAdmin &&
                      (reportedSubs.has(item.subscriptionId) ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                          <Flag className="h-3.5 w-3.5" />
                        </span>
                      ) : (
                        <button
                          onClick={() => handleReportSource(item.subscriptionId)}
                          title={t('feed:reportSource')}
                          aria-label={t('feed:reportSource')}
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        >
                          <Flag className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleHide(item.id)}
                          title={t('admin:moderation.hide')}
                          aria-label={t('admin:moderation.hide')}
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        >
                          <EyeOff className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleBanSubscription(item.subscriptionId)}
                          title={t('admin:moderation.ban')}
                          aria-label={t('admin:moderation.ban')}
                          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
                        >
                          <Ban className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                }
                footer={<CommentSection feedItemId={item.id} />}
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

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground">{t('common:loading')}</p>
      )}

      {!isAuthenticated && registrationMode === 'open' && (
        <div className="pt-4 text-center">
          <Link to="/register">
            <Button>{t('common:nav.register')}</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
