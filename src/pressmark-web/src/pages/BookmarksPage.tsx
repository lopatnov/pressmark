import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { toast } from 'sonner'
import { Ban, BookMarked, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { feedClient } from '@/api/clients'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { useIntersectionLoader } from '@/hooks/useIntersectionLoader'

interface BookmarkItem {
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

export function BookmarksPage() {
  const { t } = useTranslation(['feed', 'common', 'subscriptions'])
  usePageTitle(t('common:nav.bookmarks'))
  const [searchParams, setSearchParams] = useSearchParams()
  const activeSubId = searchParams.get('sub') ?? ''

  const [items, setItems] = useState<BookmarkItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading] = useState(true)

  const loadBookmarks = useCallback(
    async (cursor = '') => {
      setIsLoading(true)
      try {
        const res = await feedClient.getBookmarks({
          pageSize: 20,
          cursor,
          subscriptionId: activeSubId,
        })
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
        toast.error(t('common:error'))
      } finally {
        setIsLoading(false)
      }
    },
    [t, activeSubId],
  )

  const handleLoadMore = useCallback(() => {
    if (!isLoading) loadBookmarks(nextCursor)
  }, [nextCursor, isLoading, loadBookmarks])

  const sentinelRef = useIntersectionLoader(handleLoadMore, !!nextCursor && !isLoading)

  const handleRemoveBookmark = async (id: string) => {
    try {
      await feedClient.toggleBookmark({ feedItemId: id })
      setItems((prev) => prev.filter((item) => item.id !== id))
    } catch {
      toast.error(t('common:error'))
    }
  }

  useEffect(() => {
    setItems([])
    setNextCursor('')
    loadBookmarks()
  }, [activeSubId, loadBookmarks])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{t('common:nav.bookmarks')}</h1>

      {activeSubId && items.length > 0 && (
        <div
          className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground ${items[0].isSourceBanned ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/40'}`}
        >
          <span className="flex flex-1 items-center gap-2">
            {t('feed:filterBySource')}:{' '}
            <span className="font-medium text-foreground">{items[0].sourceTitle}</span>
            {items[0].isSourceBanned && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                <Ban className="h-3 w-3" />
                {t('subscriptions:banned')}
              </span>
            )}
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

      {items.length === 0 && !isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('feed:empty')}</p>
      )}

      <div className="space-y-2">
        {isLoading && items.length === 0
          ? Array.from({ length: 4 }).map((_, i) => (
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
                  item.subscriptionId ? `/bookmarks?sub=${item.subscriptionId}` : undefined
                }
                actions={
                  <button
                    onClick={() => handleRemoveBookmark(item.id)}
                    title={t('feed:removeBookmark')}
                    aria-label={t('feed:removeBookmark')}
                    className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-amber-500 transition-colors hover:bg-muted"
                  >
                    <BookMarked className="h-3.5 w-3.5 fill-current" />
                    <span>{t('feed:removeBookmark')}</span>
                  </button>
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
