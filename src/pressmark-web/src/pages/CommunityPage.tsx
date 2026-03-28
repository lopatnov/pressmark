import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Heart, EyeOff, Ban, Rss, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
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
  hidden: boolean
}

export function CommunityPage() {
  const { t } = useTranslation(['feed', 'common', 'admin'])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin = useAuthStore((s) => s.isAdmin())
  const registrationMode = useAuthStore((s) => s.registrationMode)
  const { subscriptions, addSubscription } = useSubscriptionStore()

  const [items, setItems] = useState<CommunityItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [subscribedUrls, setSubscribedUrls] = useState<Set<string>>(
    () => new Set(subscriptions.map((s) => s.rssUrl)),
  )

  const loadFeed = useCallback(
    async (cursor = '', signal?: AbortSignal) => {
      setIsLoading(true)
      try {
        const res = await feedClient.getCommunityFeed({ pageSize: 20, cursor }, { signal })
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
          hidden: false,
        }))
        if (cursor) {
          setItems((prev) => [...prev, ...mapped])
        } else {
          setItems(mapped)
        }
        setNextCursor(res.nextCursor)
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return
        toast.error(t('common:error'))
      } finally {
        setIsLoading(false)
      }
    },
    [t],
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
    try {
      const res = await subscriptionClient.addSubscription({ rssUrl, title })
      addSubscription({
        id: res.id,
        rssUrl: res.rssUrl,
        title: res.title,
        lastFetchedAt: res.lastFetchedAt,
        createdAt: '',
      })
      setSubscribedUrls((prev) => new Set(prev).add(rssUrl))
      toast.success(t('feed:subscribeSuccess'))
    } catch {
      toast.error(t('common:error'))
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
  }, [loadFeed])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('feed:community.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('feed:community.subtitle', { days: 1 })}</p>
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
