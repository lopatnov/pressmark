import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Heart } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { feedClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'
import { FeedItemCard } from '@/components/feed/FeedItemCard'

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
}

export function CommunityPage() {
  const { t } = useTranslation(['feed', 'common'])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())

  const [items, setItems]           = useState<CommunityItem[]>([])
  const [nextCursor, setNextCursor] = useState('')
  const [isLoading, setIsLoading]   = useState(false)

  const loadFeed = async (cursor = '') => {
    setIsLoading(true)
    try {
      const res = await feedClient.getCommunityFeed({ pageSize: 20, cursor })
      const mapped = res.items.map((item) => ({
        id:          item.id,
        title:       item.title,
        url:         item.url,
        summary:     item.summary,
        publishedAt: item.publishedAt,
        likeCount:   item.likeCount,
        isLiked:     item.isLiked,
        sourceTitle: item.sourceTitle,
        imageUrl:    item.imageUrl,
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

  const handleLike = async (id: string) => {
    try {
      const res = await feedClient.toggleLike({ feedItemId: id })
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isLiked: res.isLiked, likeCount: res.likeCount } : item
        )
      )
    } catch {}
  }

  useEffect(() => { loadFeed() }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">{t('feed:community.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {t('feed:community.subtitle', { days: 1 })}
        </p>
      </div>

      {!isAuthenticated && (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          {t('feed:community.empty')}{' '}
          <Link to="/login" className="underline">{t('common:nav.login')}</Link>
          {' '}&middot;{' '}
          <Link to="/register" className="underline">{t('common:nav.register')}</Link>
        </p>
      )}

      {items.length === 0 && !isLoading && isAuthenticated && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('feed:community.empty')}
        </p>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <FeedItemCard
            key={item.id}
            item={item}
            actions={
              isAuthenticated ? (
                <button
                  onClick={() => handleLike(item.id)}
                  className={`flex items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${item.isLiked ? 'text-rose-500' : 'text-muted-foreground'}`}
                >
                  <Heart className={`h-3.5 w-3.5 ${item.isLiked ? 'fill-current' : ''}`} />
                  {item.likeCount > 0 && <span>{item.likeCount}</span>}
                </button>
              ) : (
                <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
                  <Heart className="h-3.5 w-3.5" />
                  {item.likeCount > 0 && <span>{item.likeCount}</span>}
                </span>
              )
            }
          />
        ))}
      </div>

      {nextCursor && (
        <div className="pt-2 text-center">
          <Button variant="outline" disabled={isLoading} onClick={() => loadFeed(nextCursor)}>
            {t('feed:loadMore')}
          </Button>
        </div>
      )}

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground">{t('common:loading')}</p>
      )}

      {!isAuthenticated && (
        <div className="pt-4 text-center">
          <Link to="/register">
            <Button>{t('common:nav.register')}</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
