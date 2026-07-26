import { useTranslation } from 'react-i18next'
import { Ban, Check, EyeOff, Flag, Heart, Rss } from 'lucide-react'
import type { CommunityItem } from '@/hooks/useCommunityFeed'

interface Props {
  readonly item: CommunityItem
  readonly isAuthenticated: boolean
  readonly isAdmin: boolean
  readonly isSubscribed: boolean
  readonly isReported: boolean
  readonly onLike: (id: string) => void
  readonly onSubscribe: (rssUrl: string, title: string) => void
  readonly onReport: (subscriptionId: string) => void
  readonly onHide: (id: string) => void
  readonly onBan: (subscriptionId: string) => void
}

/**
 * Action row under a community feed card. What is offered depends on the viewer:
 * anonymous visitors see counts only, signed-in users can like/subscribe/report,
 * and admins get the hide and ban controls instead of reporting.
 */
export function CommunityItemActions({
  item,
  isAuthenticated,
  isAdmin,
  isSubscribed,
  isReported,
  onLike,
  onSubscribe,
  onReport,
  onHide,
  onBan,
}: Props) {
  const { t } = useTranslation(['feed', 'common', 'admin'])

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {isAuthenticated ? (
        <button
          onClick={() => onLike(item.id)}
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

      {item.sourceRssUrl && !isSubscribed && (
        <button
          onClick={() => onSubscribe(item.sourceRssUrl, item.sourceTitle)}
          title={t('feed:subscribe')}
          aria-label={t('feed:subscribe')}
          className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Rss className="h-3.5 w-3.5" />
          <span>{t('feed:subscribe')}</span>
        </button>
      )}
      {item.sourceRssUrl && isSubscribed && (
        <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
          <Check className="h-3.5 w-3.5" />
          <span>{t('feed:subscribed')}</span>
        </span>
      )}

      {isAuthenticated &&
        !isAdmin &&
        (isReported ? (
          <span className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground">
            <Flag className="h-3.5 w-3.5" />
          </span>
        ) : (
          <button
            onClick={() => onReport(item.subscriptionId)}
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
            onClick={() => onHide(item.id)}
            title={t('admin:moderation.hide')}
            aria-label={t('admin:moderation.hide')}
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <EyeOff className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onBan(item.subscriptionId)}
            title={t('admin:moderation.ban')}
            aria-label={t('admin:moderation.ban')}
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
          >
            <Ban className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </div>
  )
}
