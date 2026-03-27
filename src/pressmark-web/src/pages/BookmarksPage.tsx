import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { feedClient } from '@/api/clients'
import { FeedItemCard } from '@/components/feed/FeedItemCard'

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

  const [items, setItems]           = useState<BookmarkItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading]   = useState(false)

  const loadBookmarks = async (cursor = '') => {
    setIsLoading(true)
    try {
      const res = await feedClient.getBookmarks({ pageSize: 20, cursor })
      const mapped = res.items.map((item) => ({
        id:          item.id,
        title:       item.title,
        url:         item.url,
        summary:     item.summary,
        publishedAt: item.publishedAt,
        likeCount:   item.likeCount,
        sourceTitle: item.sourceTitle,
      }))
      if (cursor) {
        setItems((prev) => [...prev, ...mapped])
      } else {
        setItems(mapped)
      }
      setNextCursor(res.nextCursor)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRemoveBookmark = async (id: string) => {
    await feedClient.toggleBookmark({ feedItemId: id })
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  useEffect(() => { loadBookmarks() }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <h1 className="text-xl font-semibold">{t('common:nav.bookmarks')}</h1>

      {items.length === 0 && !isLoading && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('feed:empty')}</p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
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
        <div className="pt-2 text-center">
          <Button variant="outline" disabled={isLoading} onClick={() => loadBookmarks(nextCursor)}>
            {t('feed:loadMore')}
          </Button>
        </div>
      )}

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground">{t('common:loading')}</p>
      )}
    </div>
  )
}
