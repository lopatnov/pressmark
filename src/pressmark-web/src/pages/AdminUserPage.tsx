import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ExternalLink, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { adminClient } from '@/api/clients'
import { toast } from 'sonner'

interface UserDetails {
  id: string
  email: string
  role: string
  createdAt: string
  isCommentingBanned: boolean
  isSiteBanned: boolean
  subscriptions: {
    id: string
    rssUrl: string
    title: string
    isCommunityBanned: boolean
  }[]
  comments: {
    id: string
    body: string
    createdAt: string
    feedItemId: string
    feedItemTitle: string
    removedByAdmin: boolean
  }[]
}

export function AdminUserPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation(['admin', 'common'])
  const [details, setDetails] = useState<UserDetails | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    adminClient
      .getUserDetails({ userId: id })
      .then((res) => {
        const u = res.user!
        setDetails({
          id: u.id,
          email: u.email,
          role: u.role,
          createdAt: u.createdAt,
          isCommentingBanned: u.isCommentingBanned,
          isSiteBanned: u.isSiteBanned,
          subscriptions: res.subscriptions.map((s) => ({
            id: s.id,
            rssUrl: s.rssUrl,
            title: s.title,
            isCommunityBanned: s.isCommunityBanned,
          })),
          comments: res.comments.map((c) => ({
            id: c.id,
            body: c.body,
            createdAt: c.createdAt,
            feedItemId: c.feedItemId,
            feedItemTitle: c.feedItemTitle,
            removedByAdmin: c.removedByAdmin,
          })),
        })
      })
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const handleChangeRole = async () => {
    if (!details) return
    const newRole = details.role === 'Admin' ? 'User' : 'Admin'
    try {
      await adminClient.changeUserRole({ userId: details.id, role: newRole })
      setDetails((d) => (d ? { ...d, role: newRole } : d))
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('last admin')) {
        toast.error(t('admin:users.cannotDemoteLastAdmin'))
      } else {
        toast.error(t('common:error'))
      }
    }
  }

  const handleToggleSiteBan = async () => {
    if (!details) return
    try {
      await adminClient.sitebanUser({ userId: details.id, banned: !details.isSiteBanned })
      setDetails((d) => (d ? { ...d, isSiteBanned: !d.isSiteBanned } : d))
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleDelete = async () => {
    if (!details) return
    try {
      await adminClient.deleteUser({ userId: details.id })
      toast.success(t('admin:users.deleted'))
      navigate('/admin')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      if (msg.includes('last admin')) {
        toast.error(t('admin:users.cannotDeleteLastAdmin'))
      } else if (msg.includes('own account')) {
        toast.error(t('admin:users.cannotDeleteSelf'))
      } else {
        toast.error(t('common:error'))
      }
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">{t('admin:users.notFound')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-2">
        <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">{t('admin:users.profileTitle')}</h1>
      </div>

      {/* Profile card */}
      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="font-medium">{details.email}</p>
            <p className="text-xs text-muted-foreground">
              {t('admin:users.joined')}:{' '}
              {details.createdAt ? new Date(details.createdAt).toLocaleDateString() : '—'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            <span
              className={`rounded px-1.5 py-0.5 text-xs font-medium ${details.role === 'Admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
            >
              {details.role}
            </span>
            {details.isCommentingBanned && (
              <span className="rounded bg-orange-500/10 px-1.5 py-0.5 text-xs font-medium text-orange-600">
                {t('admin:users.commentBanned')}
              </span>
            )}
            {details.isSiteBanned && (
              <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                {t('admin:users.siteBanned')}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="outline" onClick={handleChangeRole}>
            {details.role === 'Admin'
              ? t('admin:users.demoteToUser')
              : t('admin:users.promoteToAdmin')}
          </Button>
          <Button
            size="sm"
            variant={details.isSiteBanned ? 'destructive' : 'outline'}
            onClick={handleToggleSiteBan}
          >
            {details.isSiteBanned ? t('admin:users.unsiteBan') : t('admin:users.siteBan')}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="destructive">
                {t('admin:users.deleteUser')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('admin:users.confirmDeleteTitle')}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t('admin:users.confirmDeleteDesc', { email: details.email })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete}>{t('common:delete')}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Subscriptions */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">{t('admin:users.subscriptions')}</h2>
        {details.subscriptions.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin:users.noSubscriptions')}</p>
        ) : (
          <div className="rounded-lg border border-border">
            <table className="w-full text-sm">
              <tbody>
                {details.subscriptions.map((sub) => (
                  <tr key={sub.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium">{sub.title || sub.rssUrl}</span>
                        {sub.isCommunityBanned && (
                          <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                            {t('admin:bannedSubs.banned')}
                          </span>
                        )}
                      </div>
                      {sub.title && (
                        <p className="text-xs text-muted-foreground truncate max-w-sm">
                          {sub.rssUrl}
                        </p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Comments */}
      <section className="space-y-2">
        <h2 className="text-base font-semibold">
          {t('admin:users.comments')} ({details.comments.length})
        </h2>
        {details.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('admin:users.noComments')}</p>
        ) : (
          <div className="space-y-2">
            {details.comments.map((c) => (
              <div
                key={c.id}
                className={`rounded-lg border border-border p-3 text-sm ${c.removedByAdmin ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`flex-1 ${c.removedByAdmin ? 'italic text-muted-foreground' : ''}`}>
                    {c.removedByAdmin ? t('admin:users.commentRemoved') : c.body}
                  </p>
                  {c.feedItemId && !c.removedByAdmin && (
                    <Link
                      to={`/article/${c.feedItemId}`}
                      className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      title={c.feedItemTitle}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Link>
                  )}
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
    </div>
  )
}
