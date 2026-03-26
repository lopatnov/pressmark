import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookMarked, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { feedClient } from '@/api/clients'

const stripHtml = (html: string) => html.replace(/<[^>]+>/g, '').trim()

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
          <article key={item.id} className="rounded-lg border border-border bg-card p-4 space-y-1.5">
            <div className="flex items-start justify-between gap-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium leading-snug hover:underline"
              >
                {item.title}
              </a>
              <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {item.sourceTitle && <span className="font-medium">{item.sourceTitle}</span>}
              {item.sourceTitle && <span>·</span>}
              <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : ''}</span>
            </div>

            {item.summary && (
              <p className="line-clamp-2 text-xs text-muted-foreground">{stripHtml(item.summary)}</p>
            )}

            <div className="flex items-center gap-1 pt-1">
              <button
                onClick={() => handleRemoveBookmark(item.id)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-amber-500 transition-colors hover:bg-muted"
              >
                <BookMarked className="h-3.5 w-3.5 fill-current" />
                <span>{t('feed:removeBookmark')}</span>
              </button>
            </div>
          </article>
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
