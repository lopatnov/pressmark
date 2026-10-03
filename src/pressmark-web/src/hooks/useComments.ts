import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminClient, feedClient } from '@/api/clients'
import type { Comment as CommentMessage } from '@/api/generated/feed_pb'
import { useLatestRequest } from '@/hooks/useLatestRequest'

export interface CommentItem {
  id: string
  userEmail: string
  body: string
  createdAt: string
  removedByAdmin: boolean
  isCommentingBanned: boolean
}

function toCommentItem(c: CommentMessage): CommentItem {
  return {
    id: c.id,
    userEmail: c.userEmail,
    body: c.body,
    createdAt: c.createdAt,
    removedByAdmin: c.removedByAdmin,
    isCommentingBanned: c.isCommentingBanned,
  }
}

/**
 * Owns an article's comment thread: loading it on first open, posting, the admin
 * removal, reporting a comment and the reply-notification subscription, leaving
 * CommentSection with layout only.
 *
 * One thread per mount: the state (draft included) belongs to the article it was
 * opened for, so a caller that can switch articles under a mounted section keys it
 * by article id, as ArticlePage does.
 *
 * @param feedItemId The article whose thread this is.
 * @param initiallyOpen Open the thread (and load it) straight away.
 */
export function useComments(feedItemId: string, initiallyOpen: boolean) {
  const { t } = useTranslation(['feed', 'common'])
  const { start, abort } = useLatestRequest()

  const [open, setOpen] = useState(initiallyOpen)
  const [loaded, setLoaded] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [reportedIds, setReportedIds] = useState<ReadonlySet<string>>(new Set())
  const [reportingId, setReportingId] = useState<string | null>(null)
  const [reportReason, setReportReason] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)

  const fetchComments = useCallback(
    async (signal: AbortSignal) => {
      try {
        const res = await feedClient.listComments({ feedItemId }, { signal })
        if (signal.aborted) return
        setComments(res.items.map(toCommentItem))
        setIsSubscribed(res.isSubscribed)
        setLoaded(true)
      } catch {
        if (!signal.aborted) toast.error(t('comments.loadError'))
      }
    },
    [feedItemId, t],
  )

  const load = useCallback(
    () => start((signal) => void fetchComments(signal)),
    [start, fetchComments],
  )

  // Aborting on cleanup means a thread that is unmounted, or whose article changed,
  // never has a late response land on top of the thread that replaced it.
  useEffect(() => {
    if (initiallyOpen) load()
    return abort
  }, [initiallyOpen, load, abort])

  const toggleOpen = () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) load()
  }

  const submitComment = async () => {
    const trimmed = body.trim()
    if (!trimmed) return
    setSubmitting(true)
    try {
      const res = await feedClient.addComment({ feedItemId, body: trimmed })
      setComments((prev) => [...prev, toCommentItem(res)])
      setBody('')
    } catch {
      toast.error(t('comments.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  const removeComment = async (commentId: string) => {
    try {
      await adminClient.removeComment({ commentId })
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, removedByAdmin: true } : c)),
      )
    } catch {
      toast.error(t('comments.removeError'))
    }
  }

  const toggleSubscription = async () => {
    try {
      const res = await feedClient.toggleCommentSubscription({ feedItemId })
      setIsSubscribed(res.subscribed)
    } catch {
      toast.error(t('common:error'))
    }
  }

  /** Opens the report form under a comment, or closes it if it is already open there. */
  const toggleReporting = (commentId: string) => {
    setReportingId((current) => (current === commentId ? null : commentId))
  }

  const cancelReport = () => {
    setReportingId(null)
    setReportReason('')
  }

  const submitReport = async (commentId: string) => {
    if (reportSubmitting) return
    setReportSubmitting(true)
    try {
      await feedClient.reportContent({ type: 'comment', targetId: commentId, reason: reportReason })
      setReportedIds((prev) => new Set(prev).add(commentId))
      cancelReport()
      toast.success(t('reportSent'))
    } catch {
      toast.error(t('reportSubmitError'))
    } finally {
      setReportSubmitting(false)
    }
  }

  return {
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
  }
}
