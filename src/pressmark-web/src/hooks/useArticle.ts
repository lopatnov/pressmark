import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminClient, feedClient } from '@/api/clients'
import type { FeedItemData } from '@/components/feed/FeedItemCard'

/**
 * Loads a single article and owns the actions on it: the admin hide/unhide
 * toggle and reporting its source, leaving ArticlePage with layout only.
 *
 * @param id Feed item id from the route, or undefined while the route resolves.
 */
export function useArticle(id: string | undefined) {
  const { t } = useTranslation(['feed', 'common', 'admin'])

  const [item, setItem] = useState<FeedItemData | null>(null)
  const [notFound, setNotFound] = useState(false)

  const [showReportForm, setShowReportForm] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reported, setReported] = useState(false)

  useEffect(() => {
    if (!id) return
    // Navigating between articles must not let a slow response for the previous
    // id land on top of the current one, nor leave the previous article's
    // not-found/report state on screen.
    let cancelled = false
    setItem(null)
    setNotFound(false)
    setShowReportForm(false)
    setReportReason('')
    setReported(false)

    feedClient
      .getFeedItem({ feedItemId: id })
      .then((res) => {
        if (cancelled) return
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
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  const toggleHidden = async () => {
    if (!item) return
    const hidden = !item.isHidden
    try {
      await adminClient.hideFeedItem({ feedItemId: item.id, hidden })
      setItem((prev) => (prev ? { ...prev, isHidden: hidden } : prev))
      toast.success(hidden ? t('admin:moderation.hidden') : t('admin:moderation.unhidden'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  const submitReport = async () => {
    if (!item?.subscriptionId || reportSubmitting) return
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

  return {
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
  }
}
