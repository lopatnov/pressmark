import { useSearchParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useCommunityFeed } from '@/hooks/useCommunityFeed'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { CommentSection } from '@/components/feed/CommentSection'
import { CommunityItemActions } from '@/components/feed/CommunityItemActions'
import { FeedCardSkeletonList } from '@/components/feed/FeedCardSkeleton'

export function CommunityPage() {
  const { t } = useTranslation(['feed', 'common', 'admin'])
  usePageTitle(t('common:nav.community'))
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSrcUrl = searchParams.get('src') ?? ''
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin = useAuthStore((s) => s.isAdmin())
  const registrationMode = useAuthStore((s) => s.registrationMode)
  const communityWindowDays = useAuthStore((s) => s.communityWindowDays)

  const {
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
  } = useCommunityFeed(activeSrcUrl)

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

      {items.length === 0 && !isLoading && isAuthenticated && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('feed:community.empty')}
        </p>
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
              sourceHref={
                item.sourceRssUrl ? `/?src=${encodeURIComponent(item.sourceRssUrl)}` : undefined
              }
              actions={
                <CommunityItemActions
                  item={item}
                  isAuthenticated={isAuthenticated}
                  isAdmin={isAdmin}
                  isSubscribed={subscribedUrls.has(item.sourceRssUrl)}
                  isReported={reportedSubs.has(item.subscriptionId)}
                  onLike={toggleLike}
                  onSubscribe={subscribeToSource}
                  onReport={reportSource}
                  onHide={hideItem}
                  onBan={banSource}
                />
              }
              footer={<CommentSection feedItemId={item.id} />}
            />
          ))
        )}
      </div>

      {nextCursor && (
        <div ref={sentinelRef} className="pt-2 text-center">
          <Button variant="outline" disabled={isLoading} onClick={loadMore}>
            {t('feed:loadMore')}
          </Button>
        </div>
      )}

      {isLoading && items.length > 0 && (
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
