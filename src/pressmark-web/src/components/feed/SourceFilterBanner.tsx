import { useTranslation } from 'react-i18next'
import { Ban, X } from 'lucide-react'

interface Props {
  readonly sourceTitle?: string
  readonly isBanned?: boolean
  readonly onClear: () => void
}

/**
 * "Filtered by source: <name>" strip shown above a list that is scoped to one
 * subscription, with the control that clears the filter. Shared by the personal
 * feed, the bookmarks list and the community feed.
 */
export function SourceFilterBanner({ sourceTitle, isBanned, onClear }: Props) {
  const { t } = useTranslation(['feed', 'subscriptions'])

  return (
    <div
      className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs text-muted-foreground ${isBanned ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-muted/40'}`}
    >
      <span className="flex flex-1 items-center gap-2">
        {t('feed:filterBySource')}:{' '}
        <span className="font-medium text-foreground">{sourceTitle}</span>
        {isBanned && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
            <Ban className="h-3 w-3" />
            {t('subscriptions:banned')}
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="cursor-pointer hover:text-foreground transition-colors"
        title={t('feed:clearFilter')}
        aria-label={t('feed:clearFilter')}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
