import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { BookMarked } from 'lucide-react'
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
}

export function BookmarksPage() {
  const { t } = useTranslation(['feed', 'common'])

  const [items, setItems] = useState<BookmarkItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const loadBookmarks = useCallback(
    async (cursor = '') => {
      setIsLoading(true)
      try {
        const res = await feedClient.getBookmarks({ pageSize: 20, cursor })
        const mapped = res.items.map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          summary: item.summary,
          publishedAt: item.publishedAt,
          likeCount: item.likeCount,
          sourceTitle: item.sourceTitle,
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
    [t],
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
    loadBookmarks()
  }, [loadBookmarks])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{t('common:nav.bookmarks')}</h1>

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
