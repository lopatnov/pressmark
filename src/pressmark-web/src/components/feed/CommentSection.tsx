import { useTranslation } from 'react-i18next'
import { Bell, BellOff, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/authStore'
import { useComments } from '@/hooks/useComments'
import { CommentRow } from './CommentRow'
import { ReportReasonForm } from './ReportReasonForm'

interface CommentSectionProps {
  feedItemId: string
  initiallyOpen?: boolean
}

/**
 * An article's comment thread, collapsed behind a toggle unless `initiallyOpen`.
 * State and RPCs live in useComments; see there for why a caller that switches
 * articles under it keys it by article id.
 */
export function CommentSection({ feedItemId, initiallyOpen = false }: CommentSectionProps) {
  const { t } = useTranslation(['feed', 'common'])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin = useAuthStore((s) => s.isAdmin())
  const commentsEnabled = useAuthStore((s) => s.commentsEnabled)

  const {
    open,
    loaded,
    comments,
    isSubscribed,
    body,
    setBody,
    submitting,
    reportedIds,
    reportingId,
    reportReason,
    setReportReason,
    reportSubmitting,
    toggleOpen,
    submitComment,
    removeComment,
    toggleSubscription,
    toggleReporting,
    cancelReport,
    submitReport,
  } = useComments(feedItemId, initiallyOpen)

  const count = comments.length
  const subscriptionLabel = isSubscribed
    ? t('comments.unsubscribeNotifications')
    : t('comments.subscribeNotifications')

  return (
    <div className="border-t border-border mt-2 pt-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={toggleOpen}
          className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-label={t('comments.toggle')}
        >
          <MessageSquare className="h-3.5 w-3.5" />
          {loaded && count > 0 ? t('comments.count', { count }) : t('comments.title')}
        </button>
        {isAuthenticated && loaded && (
          <button
            type="button"
            onClick={() => toggleSubscription()}
            title={subscriptionLabel}
            aria-label={subscriptionLabel}
            className="cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
          >
            {isSubscribed ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-3">
          {!loaded && <p className="text-xs text-muted-foreground">{t('common:loading')}</p>}

          {loaded && count === 0 && (
            <p className="text-xs text-muted-foreground">{t('comments.empty')}</p>
          )}

          {loaded &&
            comments.map((c) => (
              <CommentRow
                key={c.id}
                comment={c}
                canRemove={isAdmin}
                canReport={isAuthenticated && !isAdmin}
                isReported={reportedIds.has(c.id)}
                onRemove={(commentId) => removeComment(commentId)}
                onToggleReport={toggleReporting}
                reportForm={
                  reportingId === c.id && (
                    <ReportReasonForm
                      reason={reportReason}
                      onReasonChange={setReportReason}
                      submitting={reportSubmitting}
                      onSubmit={() => submitReport(c.id)}
                      onCancel={cancelReport}
                    />
                  )
                }
              />
            ))}

          {isAuthenticated && commentsEnabled && (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitComment()
              }}
              className="flex gap-2 pt-1"
            >
              <input
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={t('comments.placeholder')}
                maxLength={1000}
                className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs"
              />
              <Button type="submit" size="sm" disabled={submitting || !body.trim()}>
                {t('comments.submit')}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  )
}
