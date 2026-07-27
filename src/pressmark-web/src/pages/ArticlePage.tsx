import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { EyeOff, Eye, Flag } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useArticle } from '@/hooks/useArticle'
import { FeedItemCard } from '@/components/feed/FeedItemCard'
import { FeedCardSkeleton } from '@/components/feed/FeedCardSkeleton'
import { CommentSection } from '@/components/feed/CommentSection'
import { ReportReasonForm } from '@/components/feed/ReportReasonForm'
import { useAuthStore } from '@/store/authStore'

export function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(['feed', 'common', 'admin'])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin = useAuthStore((s) => s.isAdmin())

  const {
    item,
    notFound,
    showReportForm,
    setShowReportForm,
    reportReason,
    setReportReason,
    reportSubmitting,
    reported,
    toggleHidden,
    submitReport,
  } = useArticle(id)

  usePageTitle(item?.title ?? t('common:nav.feed'))

  if (notFound) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-muted-foreground">{t('feed:article.notFound')}</p>
        <Link to="/" className="text-sm text-primary hover:underline">
          {t('feed:article.backToCommunity')}
        </Link>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <FeedCardSkeleton />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <Link
        to="/"
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← {t('feed:article.backToCommunity')}
      </Link>

      <FeedItemCard item={item} />

      {isAdmin && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleHidden}
            className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-destructive transition-colors"
            title={item.isHidden ? t('admin:moderation.unhide') : t('admin:moderation.hide')}
          >
            {item.isHidden ? (
              <>
                <Eye className="h-3.5 w-3.5" />
                {t('admin:moderation.unhide')}
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5" />
                {t('admin:moderation.hide')}
              </>
            )}
          </button>
        </div>
      )}

      {isAuthenticated && !isAdmin && (
        <div className="flex items-center gap-2">
          {reported ? (
            <span className="text-xs text-muted-foreground">{t('feed:reportAlreadySent')}</span>
          ) : showReportForm ? (
            <ReportReasonForm
              reason={reportReason}
              onReasonChange={setReportReason}
              onSubmit={submitReport}
              onCancel={() => setShowReportForm(false)}
              submitting={reportSubmitting}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowReportForm(true)}
              className="flex cursor-pointer items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              title={t('feed:reportSource')}
            >
              <Flag className="h-3.5 w-3.5" />
              {t('feed:reportSource')}
            </button>
          )}
        </div>
      )}

      {id && <CommentSection feedItemId={id} initiallyOpen />}
    </div>
  )
}
