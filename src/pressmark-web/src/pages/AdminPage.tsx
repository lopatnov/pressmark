import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
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

// ── Moderation section ──────────────────────────────────────────────────────

function ModerationSection() {
  const { t } = useTranslation(['admin', 'common'])
  const [itemId, setItemId] = useState('')
  const [subId, setSubId] = useState('')
  const [itemMsg, setItemMsg] = useState('')
  const [subMsg, setSubMsg] = useState('')

  const handleHide = async (hidden: boolean) => {
    if (!itemId.trim()) return
    try {
      await adminClient.hideFeedItem({ feedItemId: itemId.trim(), hidden })
      setItemMsg(hidden ? t('admin:moderation.hide') : t('admin:moderation.unhide'))
      setTimeout(() => setItemMsg(''), 2000)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleBan = async (banned: boolean) => {
    if (!subId.trim()) return
    try {
      await adminClient.banSubscription({ subscriptionId: subId.trim(), banned })
      setSubMsg(banned ? t('admin:moderation.ban') : t('admin:moderation.unban'))
      setTimeout(() => setSubMsg(''), 2000)
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:moderation.title')}</h2>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <div className="space-y-1.5">
          <label htmlFor="mod-item-id" className="text-sm font-medium">
            Feed Item ID
          </label>
          <div className="flex gap-2">
            <input
              id="mod-item-id"
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
            <Button size="sm" variant="outline" onClick={() => handleHide(true)}>
              {t('admin:moderation.hide')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleHide(false)}>
              {t('admin:moderation.unhide')}
            </Button>
          </div>
          {itemMsg && <p className="text-xs text-green-600">{itemMsg} ✓</p>}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="mod-sub-id" className="text-sm font-medium">
            Subscription ID
          </label>
          <div className="flex gap-2">
            <input
              id="mod-sub-id"
              value={subId}
              onChange={(e) => setSubId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
            />
            <Button size="sm" variant="outline" onClick={() => handleBan(true)}>
              {t('admin:moderation.ban')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => handleBan(false)}>
              {t('admin:moderation.unban')}
            </Button>
          </div>
          {subMsg && <p className="text-xs text-green-600">{subMsg} ✓</p>}
        </div>
      </div>
    </section>
  )
}

// ── Banned subscriptions section ────────────────────────────────────────────

function BannedSubscriptionsSection() {
  const { t } = useTranslation(['admin', 'common'])
  const { bannedSubscriptions, setBannedSubscriptions, unbanSubscription } = useAdminStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminClient
      .listBannedSubscriptions({})
      .then((res) =>
        setBannedSubscriptions(
          res.items.map((b) => ({ id: b.id, rssUrl: b.rssUrl, title: b.title })),
        ),
      )
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleUnban = async (id: string) => {
    try {
      await adminClient.banSubscription({ subscriptionId: id, banned: false })
      unbanSubscription(id)
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:bannedSubs.title')}</h2>
      <div className="rounded-lg border border-border">
        {loading ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('common:loading')}
          </p>
        ) : bannedSubscriptions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            {t('admin:bannedSubs.empty')}
          </p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {bannedSubscriptions.map((sub) => (
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
    </section>
  )
}

// ── Users section ───────────────────────────────────────────────────────────

function UsersSection() {
  const { t } = useTranslation(['admin', 'common'])
  const { users, setUsers, updateUserCommentBan } = useAdminStore()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminClient
      .listUsers({})
      .then((res) =>
        setUsers(
          res.users.map((u) => ({
            id: u.id,
            email: u.email,
            role: u.role,
            createdAt: u.createdAt,
            isCommentingBanned: u.isCommentingBanned,
          })),
        ),
      )
      .catch(() => toast.error(t('common:error')))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleToggleCommentBan = async (userId: string, currentlyBanned: boolean) => {
    try {
      await adminClient.banUserFromCommenting({ userId, banned: !currentlyBanned })
      updateUserCommentBan(userId, !currentlyBanned)
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
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-2 text-muted-foreground">{user.email}</td>
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
                      title={
                        user.isCommentingBanned
                          ? t('admin:users.unbanComments')
                          : t('admin:users.banComments')
                      }
                    >
                      {user.isCommentingBanned
                        ? t('admin:users.unbanComments')
                        : t('admin:users.banComments')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

// ── Invites section ─────────────────────────────────────────────────────────

function InvitesSection() {
  const { t } = useTranslation(['admin', 'common'])
  const { invites, setInvites, addInvite, removeInvite } = useAdminStore()
  const [note, setNote] = useState('')
  const [expiresDays, setExpiresDays] = useState(7)
  const [newToken, setNewToken] = useState<InviteItem | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    adminClient
      .listInvites({})
      .then((res) =>
        setInvites(
          res.items.map((i) => ({
            id: i.id,
            token: '',
            note: i.note,
            createdAt: i.createdAt,
            expiresAt: i.expiresAt,
          })),
        ),
      )
      .catch(() => toast.error(t('common:error')))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGenerate = async () => {
    try {
      const res = await adminClient.generateInvite({ note, expiresDays })
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
      removeInvite(id)
      if (newToken?.id === id) setNewToken(null)
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:invites.title')}</h2>

      <div className="space-y-2 rounded-lg border border-border p-4">
        <div className="flex gap-2">
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t('admin:invites.notePlaceholder')}
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
        {invites.length === 0 ? (
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
      <InvitesSection />
      <ModerationSection />
      <BannedSubscriptionsSection />
      <UsersSection />
    </div>
  )
}
