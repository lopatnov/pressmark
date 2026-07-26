import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Ban, Check, Pencil, RefreshCw, Trash2, X } from 'lucide-react'
import type { Subscription } from '@/store/subscriptionStore'

interface Props {
  readonly subscription: Subscription
  readonly isFetching: boolean
  readonly onRefresh: (id: string) => void
  readonly onRename: (id: string, title: string) => Promise<boolean>
  readonly onRemove: (id: string) => void
}

export function SubscriptionRow({
  subscription: sub,
  isFetching,
  onRefresh,
  onRename,
  onRemove,
}: Props) {
  const { t } = useTranslation(['subscriptions', 'common'])
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState('')

  const startEdit = () => {
    setEditValue(sub.title)
    setIsEditing(true)
  }

  const saveEdit = async () => {
    const trimmed = editValue.trim()
    if (trimmed && (await onRename(sub.id, trimmed))) setIsEditing(false)
  }

  return (
    <div
      className={`group flex items-center justify-between rounded-lg border bg-card px-4 py-3 ${sub.isCommunityBanned ? 'border-destructive/50' : 'border-border'}`}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-1.5">
          {isEditing ? (
            <>
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveEdit()
                  if (e.key === 'Escape') setIsEditing(false)
                }}
                autoFocus
                aria-label={t('subscriptions:editTitle')}
                className="rounded border border-border bg-background px-2 py-0.5 text-sm"
              />
              <button
                type="button"
                onClick={saveEdit}
                aria-label={t('common:save')}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                aria-label={t('common:cancel')}
                className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <>
              <Link
                to={`/feed?sub=${sub.id}`}
                className="truncate text-sm font-medium hover:underline"
              >
                {sub.title}
              </Link>
              <button
                type="button"
                onClick={startEdit}
                title={t('subscriptions:editTitle')}
                aria-label={t('subscriptions:editTitle')}
                className="cursor-pointer rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
              >
                <Pencil className="h-3 w-3" />
              </button>
              {sub.isCommunityBanned && (
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">
                  <Ban className="h-3 w-3" />
                  {t('subscriptions:banned')}
                </span>
              )}
            </>
          )}
        </div>
        <p className="truncate text-xs text-muted-foreground">{sub.rssUrl}</p>
        {sub.lastFetchedAt && (
          <p className="text-xs text-muted-foreground">
            {t('subscriptions:lastFetched')}: {new Date(sub.lastFetchedAt).toLocaleString()}
          </p>
        )}
      </div>
      <div className="ml-3 flex items-center gap-1">
        <button
          type="button"
          onClick={() => onRefresh(sub.id)}
          disabled={isFetching}
          title={t('subscriptions:fetch')}
          aria-label={t('subscriptions:fetch')}
          className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
        <button
          type="button"
          onClick={() => onRemove(sub.id)}
          title={t('subscriptions:remove')}
          aria-label={t('subscriptions:remove')}
          className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
