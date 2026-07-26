import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { EyeOff, Eye, Flag } from 'lucide-react'
import { toast } from 'sonner'
import { adminClient, feedClient } from '@/api/clients'
import { FeedItemCard, type FeedItemData } from '@/components/feed/FeedItemCard'
import { CommentSection } from '@/components/feed/CommentSection'
import { ReportReasonForm } from '@/components/feed/ReportReasonForm'
import { useAuthStore } from '@/store/authStore'

export function ArticlePage() {
  const { id } = useParams<{ id: string }>()
  const { t } = useTranslation(['feed', 'common', 'admin'])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin = useAuthStore((s) => s.isAdmin())

  const [item, setItem] = useState<FeedItemData | null>(null)
  usePageTitle(item?.title ?? t('common:nav.feed'))
  const [notFound, setNotFound] = useState(false)

  const [showReportForm, setShowReportForm] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reported, setReported] = useState(false)

  useEffect(() => {
    if (!id) return
    feedClient
      .getFeedItem({ feedItemId: id })
      .then((res) => {
        setItem({
          id: res.id,
          title: res.title,
          url: res.url,
          summary: res.summary,
          publishedAt: res.publishedAt,
          sourceTitle: res.sourceTitle,
          imageUrl: res.imageUrl || undefined,
          subscriptionId: res.subscriptionId,
          sourceRssUrl: res.sourceRssUrl,
          isHidden: res.isHidden,
          isSourceBanned: res.isSourceBanned,
        })
      })
      .catch(() => setNotFound(true))
  }, [id])

  const handleReport = async () => {
    if (!item?.subscriptionId) return
    setReportSubmitting(true)
    try {
      await feedClient.reportContent({
        type: 'subscription',
        targetId: item.subscriptionId,
        reason: reportReason,
      })
      setReported(true)
      setShowReportForm(false)
      toast.success(t('feed:reportSent'))
    } catch {
      toast.error(t('feed:reportSubmitError'))
    } finally {
      setReportSubmitting(false)
    }
  }

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
      <div className="space-y-3 p-4">
        <div className="h-32 animate-pulse rounded-lg bg-muted" />
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
            onClick={async () => {
              try {
                const hidden = !item.isHidden
                await adminClient.hideFeedItem({ feedItemId: item.id, hidden })
                setItem((prev) => prev && { ...prev, isHidden: hidden })
                toast.success(
                  hidden ? t('admin:moderation.hidden') : t('admin:moderation.unhidden'),
                )
              } catch {
                toast.error(t('common:error'))
              }
            }}
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
              onSubmit={handleReport}
              onCancel={() => setShowReportForm(false)}
              submitting={reportSubmitting}
            />
          ) : (
            <button
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
