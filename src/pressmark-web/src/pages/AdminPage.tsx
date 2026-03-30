import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { adminClient } from '@/api/clients'
import { useAdminStore, type InviteItem } from '@/store/adminStore'
import { toast } from 'sonner'

// ── Site settings form ──────────────────────────────────────────────────────

const settingsSchema = z.object({
  siteName: z.string().min(1),
  communityWindowDays: z.number().int().min(1).max(365),
  registrationMode: z.enum(['open', 'invite_only']),
  smtpHost: z.string(),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string(),
  smtpPassword: z.string(),
  smtpUseTls: z.boolean(),
  smtpFromAddress: z.string(),
  commentsEnabled: z.boolean(),
})
type SettingsForm = z.infer<typeof settingsSchema>

function SiteSettingsSection() {
  const { t } = useTranslation(['admin', 'common'])
  const { settings, setSettings } = useAdminStore()
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsForm>({ resolver: zodResolver(settingsSchema) })

  useEffect(() => {
    if (settings)
      reset({
        ...settings,
        smtpPassword: '', // never pre-fill the password field
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings])

  const onSubmit = async (data: SettingsForm) => {
    try {
      await adminClient.updateSiteSettings({
        settings: {
          siteName: data.siteName,
          communityWindowDays: data.communityWindowDays,
          registrationMode: data.registrationMode,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpUser: data.smtpUser,
          smtpPassword: data.smtpPassword,
          smtpUseTls: data.smtpUseTls,
          smtpFromAddress: data.smtpFromAddress,
          commentsEnabled: data.commentsEnabled,
        },
      })
      setSettings(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:settings.title')}</h2>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-3 rounded-lg border border-border p-4"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('admin:settings.siteName')}</label>
          <input
            {...register('siteName')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {errors.siteName && <p className="text-xs text-destructive">{errors.siteName.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('admin:settings.communityWindowDays')}</label>
          <input
            {...register('communityWindowDays', { valueAsNumber: true })}
            type="number"
            min={1}
            max={365}
            className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {errors.communityWindowDays && (
            <p className="text-xs text-destructive">{errors.communityWindowDays.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('admin:settings.registrationMode')}</label>
          <select
            {...register('registrationMode')}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="open">{t('admin:settings.open')}</option>
            <option value="invite_only">{t('admin:settings.inviteOnly')}</option>
          </select>
        </div>

        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{t('admin:settings.smtp')}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('admin:settings.smtpHost')}</label>
              <input
                {...register('smtpHost')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('admin:settings.smtpPort')}</label>
              <input
                {...register('smtpPort', { valueAsNumber: true })}
                type="number"
                min={1}
                max={65535}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('admin:settings.smtpUser')}</label>
            <input
              {...register('smtpUser')}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('admin:settings.smtpPassword')}</label>
            <input
              {...register('smtpPassword')}
              type="password"
              autoComplete="new-password"
              placeholder={t('admin:settings.smtpPasswordPlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('admin:settings.smtpFromAddress')}</label>
            <input
              {...register('smtpFromAddress')}
              type="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="noreply@example.com"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input {...register('smtpUseTls')} type="checkbox" className="h-4 w-4" />
            {t('admin:settings.smtpUseTls')}
          </label>
        </div>

        <div className="border-t border-border pt-3">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input {...register('commentsEnabled')} type="checkbox" className="h-4 w-4" />
            {t('admin:settings.commentsEnabled')}
          </label>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isSubmitting || !settings}>
            {t('common:save')}
          </Button>
          {saved && <span className="text-xs text-green-600">{t('admin:settings.saved')}</span>}
        </div>
      </form>
    </section>
  )
}

// ── Banned subscriptions section ────────────────────────────────────────────

const PAGE_SIZE = 20

function BannedSubscriptionsSection() {
  const { t } = useTranslation(['admin', 'common'])
  const [items, setItems] = useState<{ id: string; rssUrl: string; title: string }[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const load = (p: number) => {
    setLoading(true)
    adminClient
      .listBannedSubscriptions({ pageSize: PAGE_SIZE, page: p })
      .then((res) => {
        setItems(res.items.map((b) => ({ id: b.id, rssUrl: b.rssUrl, title: b.title })))
        setTotalCount(res.totalCount)
      })
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUnban = async (id: string) => {
    try {
      await adminClient.banSubscription({ subscriptionId: id, banned: false })
      load(page)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handlePage = (p: number) => {
    setPage(p)
    load(p)
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:bannedSubs.title')}</h2>
      <div className="rounded-lg border border-border">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('common:loading')}
          </p>
        ) : items.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin:bannedSubs.empty')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {items.map((sub) => (
                <tr key={sub.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <p className="font-medium">{sub.title || sub.rssUrl}</p>
                    {sub.title && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs">
                        {sub.rssUrl}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => handleUnban(sub.id)}>
                      {t('admin:bannedSubs.unban')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => handlePage(page - 1)}
          >
            {t('admin:pagination.prev')}
          </Button>
          <span>{t('admin:pagination.pageOf', { page: page + 1, total: totalPages })}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => handlePage(page + 1)}
          >
            {t('admin:pagination.next')}
          </Button>
        </div>
      )}
    </section>
  )
}

// ── Hidden articles section ──────────────────────────────────────────────────

function HiddenArticlesSection() {
  const { t } = useTranslation(['admin', 'common'])
  const [hiddenItems, setHiddenItems] = useState<
    { id: string; title: string; url: string; sourceTitle: string }[]
  >([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const load = (p: number) => {
    setLoading(true)
    adminClient
      .listHiddenFeedItems({ pageSize: PAGE_SIZE, page: p })
      .then((res) => {
        setHiddenItems(
          res.items.map((item) => ({
            id: item.id,
            title: item.title,
            url: item.url,
            sourceTitle: item.sourceTitle,
          })),
        )
        setTotalCount(res.totalCount)
      })
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUnhide = async (id: string) => {
    try {
      await adminClient.hideFeedItem({ feedItemId: id, hidden: false })
      toast.success(t('admin:moderation.unhidden'))
      load(page)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handlePage = (p: number) => {
    setPage(p)
    load(p)
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:moderation.hiddenArticles')}</h2>
      <div className="rounded-lg border border-border">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('common:loading')}
          </p>
        ) : hiddenItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin:moderation.noHiddenArticles')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {hiddenItems.map((item) => (
                <tr key={item.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <div className="flex items-start gap-1.5">
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-medium hover:underline line-clamp-2"
                      >
                        {item.title}
                      </a>
                      <Link
                        to={`/article/${item.id}`}
                        title={t('admin:moderation.openArticle')}
                        className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <p className="text-xs text-muted-foreground">{item.sourceTitle}</p>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="outline" onClick={() => handleUnhide(item.id)}>
                      {t('admin:moderation.unhide')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => handlePage(page - 1)}
          >
            {t('admin:pagination.prev')}
          </Button>
          <span>{t('admin:pagination.pageOf', { page: page + 1, total: totalPages })}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => handlePage(page + 1)}
          >
            {t('admin:pagination.next')}
          </Button>
        </div>
      )}
    </section>
  )
}

// ── Users section ───────────────────────────────────────────────────────────

interface UserRow {
  id: string
  email: string
  role: string
  createdAt: string
  isCommentingBanned: boolean
  isSiteBanned: boolean
}

function UsersSection() {
  const { t } = useTranslation(['admin', 'common'])
  const [users, setUsers] = useState<UserRow[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const load = (p: number) => {
    setLoading(true)
    adminClient
      .listUsers({ pageSize: PAGE_SIZE, page: p })
      .then((res) => {
        setUsers(
          res.users.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            isCommentingBanned: u.isCommentingBanned,
            isSiteBanned: u.isSiteBanned,
          })),
        )
        setTotalCount(res.totalCount)
      })
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handlePage = (p: number) => {
    setPage(p)
    load(p)
  }

  const handleToggleCommentBan = async (userId: string, currentlyBanned: boolean) => {
    try {
      await adminClient.banUserFromCommenting({ userId, banned: !currentlyBanned })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isCommentingBanned: !currentlyBanned } : u)),
      )
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleToggleSiteBan = async (userId: string, currentlyBanned: boolean) => {
    try {
      await adminClient.sitebanUser({ userId, banned: !currentlyBanned })
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isSiteBanned: !currentlyBanned } : u)),
      )
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:users.title')}</h2>
      <div className="rounded-lg border border-border">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('common:loading')}
          </p>
        ) : users.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin:users.empty')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2 text-left font-medium">{t('admin:users.email')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('admin:users.role')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('admin:users.joined')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('admin:users.comments')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('admin:users.siteBanCol')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-muted-foreground">{user.email}</span>
                      {user.isSiteBanned && (
                        <span className="rounded bg-destructive/10 px-1.5 py-0.5 text-[10px] font-medium text-destructive">
                          {t('admin:users.siteBanned')}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2">
                    <span
                      className={`rounded px-1.5 py-0.5 text-xs font-medium ${user.role === 'Admin' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      size="sm"
                      variant={user.isCommentingBanned ? 'destructive' : 'outline'}
                      onClick={() => handleToggleCommentBan(user.id, user.isCommentingBanned)}
                    >
                      {user.isCommentingBanned
                        ? t('admin:users.unbanComments')
                        : t('admin:users.banComments')}
                    </Button>
                  </td>
                  <td className="px-4 py-2">
                    <Button
                      size="sm"
                      variant={user.isSiteBanned ? 'destructive' : 'outline'}
                      onClick={() => handleToggleSiteBan(user.id, user.isSiteBanned)}
                    >
                      {user.isSiteBanned ? t('admin:users.unsiteBan') : t('admin:users.siteBan')}
                    </Button>
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      to={`/admin/users/${user.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {t('admin:users.viewProfile')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => handlePage(page - 1)}
          >
            {t('admin:pagination.prev')}
          </Button>
          <span>{t('admin:pagination.pageOf', { page: page + 1, total: totalPages })}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => handlePage(page + 1)}
          >
            {t('admin:pagination.next')}
          </Button>
        </div>
      )}
    </section>
  )
}

// ── Reports section ─────────────────────────────────────────────────────────

interface ReportItem {
  id: string
  type: string
  targetId: string
  reason: string
  createdAt: string
  reporterEmail: string
  reporterJoined: string
  content: string
  contentUrl: string
  articleId: string
  targetUserEmail: string
}

function ReportsSection() {
  const { t } = useTranslation(['admin', 'common'])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const load = (p: number) => {
    setLoading(true)
    adminClient
      .listReports({ pageSize: PAGE_SIZE, page: p })
      .then((res) => {
        setReports(
          res.items.map((r) => ({
            id: r.id,
            type: r.type,
            targetId: r.targetId,
            reason: r.reason,
            createdAt: r.createdAt,
            reporterEmail: r.reporterEmail,
            reporterJoined: r.reporterJoined,
            content: r.content,
            contentUrl: r.contentUrl,
            articleId: r.articleId,
            targetUserEmail: r.targetUserEmail,
          })),
        )
        setTotalCount(res.totalCount)
      })
      .catch(() => toast.error(t('admin:reports.loadError')))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleResolve = async (id: string) => {
    try {
      await adminClient.resolveReport({ id })
      setReports((prev) => prev.filter((r) => r.id !== id))
      setTotalCount((c) => c - 1)
    } catch {
      toast.error(t('admin:reports.resolveError'))
    }
  }

  const handlePage = (p: number) => {
    setPage(p)
    load(p)
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-medium">{t('admin:reports.title')}</h2>
      {loading ? (
        <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
      ) : reports.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin:reports.empty')}</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="px-4 py-2 text-left font-medium">{t('admin:reports.issue')}</th>
                <th className="px-4 py-2 text-left font-medium">{t('admin:reports.reporter')}</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody>
              {reports.map((r) => (
                <tr key={r.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 min-w-[7rem]">
                    <p className="text-xs text-muted-foreground font-mono">
                      {r.createdAt
                        ? new Intl.DateTimeFormat(undefined, {
                            day: 'numeric',
                            month: 'long',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          }).format(new Date(r.createdAt))
                        : '—'}
                    </p>
                    <p className="text-xs font-medium">
                      {r.type === 'comment'
                        ? t('admin:reports.comment')
                        : t('admin:reports.subscription')}
                      {r.type === 'comment' && r.targetUserEmail && (
                        <span className="ml-1 font-normal text-muted-foreground">
                          {r.targetUserEmail}
                        </span>
                      )}
                    </p>
                    <div className=" text-xs text-muted-foreground min-w-[8rem]">
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {r.content || '—'}
                      </p>
                      {r.contentUrl && (
                        <p className="text-[10px] text-muted-foreground truncate">{r.contentUrl}</p>
                      )}
                      {r.articleId && (
                        <Link
                          to={`/article/${r.articleId}`}
                          className="text-[10px] text-primary hover:underline flex items-center gap-0.5 mt-0.5"
                        >
                          <ExternalLink className="h-2.5 w-2.5" />
                          {t('admin:reports.openArticle')}
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground min-w-[8rem]">
                    <p>{r.reporterEmail || '—'}</p>
                    {r.reporterJoined && (
                      <p className="text-[10px]">
                        ({new Date(r.reporterJoined).toLocaleDateString()})
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">{r.reason || '—'}</p>
                  </td>
                  <td className="px-4 py-2">
                    <Button size="sm" variant="outline" onClick={() => handleResolve(r.id)}>
                      {t('admin:reports.resolve')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || loading}
            onClick={() => handlePage(page - 1)}
          >
            {t('admin:pagination.prev')}
          </Button>
          <span>{t('admin:pagination.pageOf', { page: page + 1, total: totalPages })}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1 || loading}
            onClick={() => handlePage(page + 1)}
          >
            {t('admin:pagination.next')}
          </Button>
        </div>
      )}
    </section>
  )
}

// ── Invites section ─────────────────────────────────────────────────────────

function InvitesSection() {
  const { t } = useTranslation(['admin', 'common'])
  const { addInvite, settings } = useAdminStore()
  const [invites, setInvites] = useState<InviteItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loadingList, setLoadingList] = useState(true)
  const [note, setNote] = useState('')
  const [expiresDays, setExpiresDays] = useState(7)
  const [sendNotification, setSendNotification] = useState(false)
  const [newToken, setNewToken] = useState<InviteItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const smtpConfigured = Boolean(settings?.smtpHost)
  const noteIsValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(note)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const loadList = (p: number) => {
    setLoadingList(true)
    adminClient
      .listInvites({ pageSize: PAGE_SIZE, page: p })
      .then((res) => {
        setInvites(
          res.items.map((i) => ({
            id: i.id,
            token: '',
            note: i.note,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt,
          })),
        )
        setTotalCount(res.totalCount)
      })
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoadingList(false))
  }

  useEffect(() => {
    loadList(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    try {
      const notifyEmailArg = sendNotification && smtpConfigured && noteIsValidEmail ? note : ''
      const res = await adminClient.generateInvite({
        note,
        expiresDays,
        notifyEmail: notifyEmailArg,
      })
      const item: InviteItem = {
        id: res.id,
        token: res.token,
        note: res.note,
        createdAt: res.createdAt,
        expiresAt: res.expiresAt,
      }
      addInvite(item)
      setNewToken(item)
      setNote('')
      loadList(0)
      setPage(0)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleCopy = (token: string, id: string) => {
    navigator.clipboard.writeText(token)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const handleDelete = async (id: string) => {
    try {
      await adminClient.deleteInvite({ id })
      if (newToken?.id === id) setNewToken(null)
      loadList(page)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handlePage = (p: number) => {
    setPage(p)
    loadList(p)
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:invites.title')}</h2>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={
              smtpConfigured
                ? t('admin:invites.notifyEmailPlaceholder')
                : t('admin:invites.notePlaceholder')
            }
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          <select
            value={expiresDays}
            onChange={(e) => setExpiresDays(Number(e.target.value))}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value={1}>{t('admin:invites.expiry1Day')}</option>
            <option value={7}>{t('admin:invites.expiry7Days')}</option>
            <option value={30}>{t('admin:invites.expiry30Days')}</option>
            <option value={0}>{t('admin:invites.expiryNone')}</option>
          </select>
          <Button size="sm" onClick={handleGenerate}>
            {t('admin:invites.generate')}
          </Button>
        </div>
        {smtpConfigured && (
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={sendNotification}
              onChange={(e) => setSendNotification(e.target.checked)}
              disabled={!noteIsValidEmail}
              className="h-4 w-4"
            />
            <span className={!noteIsValidEmail ? 'text-muted-foreground' : ''}>
              {t('admin:invites.sendNotification')}
            </span>
          </label>
        )}

        {newToken && (
          <div className="rounded-md bg-muted p-3 space-y-1">
            <p className="text-xs text-muted-foreground">{t('admin:invites.tokenGenerated')}</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded bg-background px-2 py-1 text-xs font-mono">
                {newToken.token}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCopy(newToken.token, newToken.id)}
              >
                {copiedId === newToken.id ? t('admin:invites.copied') : t('admin:invites.copy')}
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border">
        {loadingList ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('common:loading')}
          </p>
        ) : invites.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin:invites.empty')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {invites.map((inv) => (
                <tr key={inv.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{inv.note || '—'}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {t('admin:invites.expiresAt')}:{' '}
                    {inv.expiresAt
                      ? new Date(inv.expiresAt).toLocaleDateString()
                      : t('admin:invites.expiryNever')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(inv.id)}>
                      {t('admin:invites.delete')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <Button
            size="sm"
            variant="outline"
            disabled={page === 0 || loadingList}
            onClick={() => handlePage(page - 1)}
          >
            {t('admin:pagination.prev')}
          </Button>
          <span>{t('admin:pagination.pageOf', { page: page + 1, total: totalPages })}</span>
          <Button
            size="sm"
            variant="outline"
            disabled={page >= totalPages - 1 || loadingList}
            onClick={() => handlePage(page + 1)}
          >
            {t('admin:pagination.next')}
          </Button>
        </div>
      )}
    </section>
  )
}

// ── AdminPage ───────────────────────────────────────────────────────────────

export function AdminPage() {
  const { t } = useTranslation('admin')
  const { setSettings, setLoading } = useAdminStore()

  useEffect(() => {
    setLoading(true)
    adminClient
      .getSiteSettings({})
      .then((res) =>
        setSettings({
          siteName: res.siteName,
          communityWindowDays: res.communityWindowDays,
          registrationMode: res.registrationMode as 'open' | 'invite_only',
          smtpHost: res.smtpHost,
          smtpPort: res.smtpPort || 587,
          smtpUser: res.smtpUser,
          smtpPassword: '', // write-only
          smtpUseTls: res.smtpUseTls,
          smtpFromAddress: res.smtpFromAddress,
          commentsEnabled: res.commentsEnabled,
        }),
      )
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="mx-auto max-w-2xl space-y-8 p-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>
      <SiteSettingsSection />
      <ReportsSection />
      <InvitesSection />
      <BannedSubscriptionsSection />
      <HiddenArticlesSection />
      <UsersSection />
    </div>
  )
}
