import { useTranslation } from 'react-i18next'
import { Bookmark, BookMarked, Heart } from 'lucide-react'

interface Props {
  readonly id: string
  readonly isLiked: boolean
  readonly likeCount: number
  readonly isBookmarked: boolean
  readonly onLike: (id: string) => void
  readonly onBookmark: (id: string) => void
}

/** Like and bookmark controls under a card in the personal feed. */
export function FeedItemActions({
  id,
  isLiked,
  likeCount,
  isBookmarked,
  onLike,
  onBookmark,
}: Props) {
  const { t } = useTranslation(['feed', 'common'])

  return (
    <>
      <button
        onClick={() => onLike(id)}
        title={isLiked ? t('feed:unlike') : t('feed:like')}
        aria-label={isLiked ? t('feed:unlike') : t('feed:like')}
        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${isLiked ? 'text-rose-500' : 'text-muted-foreground'}`}
      >
        <Heart className={`h-3.5 w-3.5 ${isLiked ? 'fill-current' : ''}`} />
        {likeCount > 0 && <span>{likeCount}</span>}
      </button>
      <button
        onClick={() => onBookmark(id)}
        title={isBookmarked ? t('feed:removeBookmark') : t('feed:bookmark')}
        aria-label={isBookmarked ? t('feed:removeBookmark') : t('feed:bookmark')}
        className={`flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs transition-colors hover:bg-muted ${isBookmarked ? 'text-amber-500' : 'text-muted-foreground'}`}
      >
        {isBookmarked ? (
          <BookMarked className="h-3.5 w-3.5 fill-current" />
        ) : (
          <Bookmark className="h-3.5 w-3.5" />
        )}
      </button>
    </>
  )
}
