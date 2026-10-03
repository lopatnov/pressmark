import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Flag, Trash2 } from 'lucide-react'
import type { CommentItem } from '@/hooks/useComments'
import { formatDateTime } from './feedUtils'

interface Props {
  readonly comment: CommentItem
  /** Admins remove comments rather than report them. */
  readonly canRemove: boolean
  readonly canReport: boolean
  readonly isReported: boolean
  readonly onRemove: (id: string) => void
  readonly onToggleReport: (id: string) => void
  /** The report form, when it is open under this comment. */
  readonly reportForm?: ReactNode
}

/** One comment in an article's thread; a removed comment renders as a placeholder. */
export function CommentRow({
  comment: c,
  canRemove,
  canReport,
  isReported,
  onRemove,
  onToggleReport,
  reportForm,
}: Props) {
  const { t } = useTranslation(['feed', 'common'])

  if (c.removedByAdmin) {
    return <p className="text-xs italic text-muted-foreground/60">{t('comments.removed')}</p>
  }

  return (
    <div className="space-y-0.5">
      <div className="flex items-start justify-between gap-2">
        <div className="space-y-0.5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium">{c.userEmail}</span>
            {c.isCommentingBanned && (
              <span className="rounded bg-destructive/10 px-1 py-0.5 text-[10px] font-medium text-destructive">
                {t('common:banned')}
              </span>
            )}
            <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
          </div>
          <p className="text-xs text-foreground/90 whitespace-pre-wrap">{c.body}</p>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(c.id)}
            title={t('comments.remove')}
            aria-label={t('comments.remove')}
            className="cursor-pointer shrink-0 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
        {canReport &&
          (isReported ? (
            <Check className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
          ) : (
            <button
              type="button"
              onClick={() => onToggleReport(c.id)}
              title={t('reportComment')}
              aria-label={t('reportComment')}
              className="cursor-pointer shrink-0 text-muted-foreground/60 hover:text-muted-foreground transition-colors"
            >
              <Flag className="h-3.5 w-3.5" />
            </button>
          ))}
      </div>
      {reportForm && <div className="pt-1">{reportForm}</div>}
    </div>
  )
}
