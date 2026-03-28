import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquare, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { adminClient, feedClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'

interface CommentItem {
  id: string
  userEmail: string
  body: string
  createdAt: string
  removedByAdmin: boolean
}

interface CommentSectionProps {
  feedItemId: string
}

export function CommentSection({ feedItemId }: CommentSectionProps) {
  const { t } = useTranslation(['feed', 'common'])
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin = useAuthStore((s) => s.isAdmin())

  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [body, setBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    try {
      const res = await feedClient.listComments({ feedItemId })
      setComments(
        res.items.map((c) => ({
          id: c.id,
          userEmail: c.userEmail,
          body: c.body,
          createdAt: c.createdAt,
          removedByAdmin: c.removedByAdmin,
        })),
      )
      setLoaded(true)
    } catch {
      toast.error(t('comments.loadError'))
    }
  }

  const handleToggle = () => {
    const next = !open
    setOpen(next)
    if (next && !loaded) load()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!body.trim()) return
    setSubmitting(true)
    try {
      const res = await feedClient.addComment({ feedItemId, body: body.trim() })
      setComments((prev) => [
        ...prev,
        {
          id: res.id,
          userEmail: res.userEmail,
          body: res.body,
          createdAt: res.createdAt,
          removedByAdmin: res.removedByAdmin,
        },
      ])
      setBody('')
    } catch {
      toast.error(t('comments.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleRemove = async (commentId: string) => {
    try {
      await adminClient.removeComment({ commentId })
      setComments((prev) =>
        prev.map((c) => (c.id === commentId ? { ...c, removedByAdmin: true } : c)),
      )
    } catch {
      toast.error(t('comments.removeError'))
    }
  }

  const count = comments.length

  return (
    <div className="border-t border-border mt-2 pt-2">
      <button
        onClick={handleToggle}
        className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        aria-label={t('comments.toggle')}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        {loaded && count > 0 ? t('comments.count', { count }) : t('comments.title')}
      </button>

      {open && (
        <div className="mt-3 space-y-3">
          {!loaded && <p className="text-xs text-muted-foreground">{t('common:loading')}</p>}

          {loaded && comments.length === 0 && (
            <p className="text-xs text-muted-foreground">{t('comments.empty')}</p>
          )}

          {loaded &&
            comments.map((c) => (
              <div key={c.id} className="space-y-0.5">
                {c.removedByAdmin ? (
                  <p className="text-xs italic text-muted-foreground/60">{t('comments.removed')}</p>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium">{c.userEmail}</span>
                          <span className="text-xs text-muted-foreground">
                            {c.createdAt
                              ? new Date(c.createdAt).toLocaleString(undefined, {
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                        <p className="text-xs text-foreground/90 whitespace-pre-wrap">{c.body}</p>
                      </div>
                      {isAdmin && (
                        <button
                          onClick={() => handleRemove(c.id)}
                          title={t('comments.remove')}
                          aria-label={t('comments.remove')}
                          className="cursor-pointer shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            ))}

          {isAuthenticated && (
            <form onSubmit={handleSubmit} className="flex gap-2 pt-1">
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
