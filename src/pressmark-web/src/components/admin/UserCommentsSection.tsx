import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Trash2 } from 'lucide-react'
import type { AdminUserComment } from '@/hooks/useAdminUserDetails'

interface Props {
  readonly comments: readonly AdminUserComment[]
  readonly onRemove: (commentId: string) => void
}

export function UserCommentsSection({ comments, onRemove }: Props) {
  const { t } = useTranslation(['admin', 'common'])

  return (
    <section className="space-y-2">
      <h2 className="text-base font-semibold">
        {t('admin:users.comments')} ({comments.length})
      </h2>
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin:users.noComments')}</p>
      ) : (
        <div className="space-y-2">
          {comments.map((c) => (
            <div
              key={c.id}
              className={`rounded-lg border border-border p-3 text-sm ${c.removedByAdmin ? 'opacity-50' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <p className={`flex-1 ${c.removedByAdmin ? 'italic text-muted-foreground' : ''}`}>
                  {c.removedByAdmin ? t('admin:users.commentRemoved') : c.body}
                </p>
                <div className="flex items-center gap-2 shrink-0">
                  {c.feedItemId && !c.removedByAdmin && (
                    <Link
                      to={`/article/${c.feedItemId}`}
                      className="text-muted-foreground hover:text-foreground transition-colors"
                      title={c.feedItemTitle}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
                  {!c.removedByAdmin && (
                    <button
                      onClick={() => onRemove(c.id)}
                      title={t('admin:users.commentRemoved')}
                      className="cursor-pointer text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {c.feedItemTitle && !c.removedByAdmin && (
                <p className="mt-1 text-xs text-muted-foreground truncate">{c.feedItemTitle}</p>
              )}
              <p className="mt-1 text-[10px] text-muted-foreground">
                {c.createdAt ? new Date(c.createdAt).toLocaleString() : ''}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
