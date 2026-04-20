import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { toast } from 'sonner'
import {
  Ban,
  Bell,
  BellOff,
  Check,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { Code, ConnectError } from '@connectrpc/connect'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { subscriptionClient } from '@/api/clients'
import { useSubscriptionStore } from '@/store/subscriptionStore'

const schema = z.object({
  rssUrl: z.string().url(),
  title: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function SubscriptionsPage() {
  const { t } = useTranslation(['subscriptions', 'common'])
  usePageTitle(t('common:nav.subscriptions'))
  const {
    subscriptions,
    digestEnabled,
    isLoading,
    setSubscriptions,
    addSubscription,
    removeSubscription,
    updateSubscriptionTitle,
    setDigestEnabled,
    setLoading,
  } = useSubscriptionStore()
  const [showForm, setShowForm] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const [fetchingId, setFetchingId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    setLoading(true)
    subscriptionClient
      .listSubscriptions({})
      .then((res) => {
        setSubscriptions(
          res.subscriptions.map((s) => ({
            id: s.id,
            rssUrl: s.rssUrl,
            title: s.title,
            lastFetchedAt: s.lastFetchedAt,
            createdAt: s.createdAt,
            isCommunityBanned: s.isCommunityBanned,
          })),
        )
        setDigestEnabled(res.digestEnabled)
      })
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (data: FormData) => {
    try {
      const sub = await subscriptionClient.addSubscription({
        rssUrl: data.rssUrl,
        title: data.title ?? '',
      })
      addSubscription({
        id: sub.id,
        rssUrl: sub.rssUrl,
        title: sub.title,
        lastFetchedAt: sub.lastFetchedAt,
        createdAt: sub.createdAt,
        isCommunityBanned: sub.isCommunityBanned,
      })
      reset()
      setShowForm(false)
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
        setError('rssUrl', { message: err.message || t('subscriptions:errors.fetchFailed') })
      } else {
        setError('root', { message: t('common:error') })
      }
    }
  }

  const handleExport = async () => {
    try {
      const res = await subscriptionClient.exportSubscriptions({})
      const blob = new Blob([res.opmlContent], { type: 'text/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'subscriptions.opml'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const opmlContent = ev.target?.result as string
      try {
        const res = await subscriptionClient.importSubscriptions({ opmlContent })
        setImportStatus(
          t('subscriptions:importSuccess', {
            imported: res.imported,
            skipped: res.skipped,
          }),
        )
        // Refresh the list
        const list = await subscriptionClient.listSubscriptions({})
        setSubscriptions(
          list.subscriptions.map((s) => ({
            id: s.id,
            rssUrl: s.rssUrl,
            title: s.title,
            lastFetchedAt: s.lastFetchedAt,
            createdAt: s.createdAt,
            isCommunityBanned: s.isCommunityBanned,
          })),
        )
      } catch {
        setImportStatus(t('subscriptions:importError'))
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.onerror = () => {
      setImportStatus(t('subscriptions:importError'))
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  const handleFetch = async (id: string) => {
    setFetchingId(id)
    try {
      await subscriptionClient.triggerFetch({ subscriptionId: id })
      // Refresh the subscription to get the updated lastFetchedAt
      const list = await subscriptionClient.listSubscriptions({})
      setSubscriptions(
        list.subscriptions.map((s) => ({
          id: s.id,
          rssUrl: s.rssUrl,
          title: s.title,
          lastFetchedAt: s.lastFetchedAt,
          createdAt: s.createdAt,
          isCommunityBanned: s.isCommunityBanned,
        })),
      )
    } catch {
      toast.error(t('common:error'))
    } finally {
      setFetchingId(null)
    }
  }

  const handleStartEdit = (id: string, title: string) => {
    setEditingId(id)
    setEditValue(title)
  }

  const handleSaveEdit = async (id: string) => {
    try {
      const res = await subscriptionClient.updateSubscription({
        subscriptionId: id,
        displayName: editValue,
      })
      updateSubscriptionTitle(id, res.title)
      setEditingId(null)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleRemove = async (id: string) => {
    if (!confirm(t('subscriptions:removeConfirm'))) return
    removeSubscription(id)
    await subscriptionClient.removeSubscription({ subscriptionId: id }).catch(() => {})
  }

  const handleToggleDigest = async () => {
    try {
      const res = await subscriptionClient.toggleDigestSubscription({})
      setDigestEnabled(res.enabled)
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('subscriptions:title')}</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={digestEnabled ? 'default' : 'outline'}
            onClick={handleToggleDigest}
            title={
              digestEnabled ? t('subscriptions:digestDisable') : t('subscriptions:digestEnable')
            }
          >
            {digestEnabled ? (
              <Bell className="mr-1 h-4 w-4" />
            ) : (
              <BellOff className="mr-1 h-4 w-4" />
            )}
            {t('subscriptions:digest')}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="mr-1 h-4 w-4" />
            {t('subscriptions:export')}
          </Button>
          <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" />
            {t('subscriptions:import')}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".opml,.xml"
            className="hidden"
            onChange={handleImport}
          />
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('subscriptions:add')}
          </Button>
        </div>
      </div>

      {importStatus && <p className="rounded-md bg-muted px-3 py-2 text-sm">{importStatus}</p>}

      {showForm && (
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-3 rounded-lg border border-border p-4"
        >
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('subscriptions:rssUrl')}</label>
            <input
              {...register('rssUrl')}
              type="url"
              placeholder="https://example.com/rss.xml"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.rssUrl && <p className="text-xs text-destructive">{errors.rssUrl.message}</p>}
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('subscriptions:feedTitle')}</label>
            <input
              {...register('title')}
              type="text"
              placeholder={t('subscriptions:feedTitlePlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>
          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {t('common:save')}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              {t('common:cancel')}
            </Button>
          </div>
        </form>
      )}

      {isLoading && subscriptions.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="space-y-1.5 flex-1 min-w-0">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-64" />
              </div>
              <Skeleton className="h-7 w-16 ml-2" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && subscriptions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">
          {t('subscriptions:empty')}
        </p>
      )}

      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <div
            key={sub.id}
            className={`group flex items-center justify-between rounded-lg border bg-card px-4 py-3 ${sub.isCommunityBanned ? 'border-destructive/50' : 'border-border'}`}
          >
            <div className="min-w-0 space-y-0.5">
              <div className="flex items-center gap-1.5">
                {editingId === sub.id ? (
                  <>
                    <input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(sub.id)
                        if (e.key === 'Escape') setEditingId(null)
                      }}
                      autoFocus
                      className="rounded border border-border bg-background px-2 py-0.5 text-sm"
                    />
                    <button
                      onClick={() => handleSaveEdit(sub.id)}
                      aria-label={t('common:save')}
                      className="cursor-pointer rounded p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
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
                      onClick={() => handleStartEdit(sub.id, sub.title)}
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
                onClick={() => handleFetch(sub.id)}
                disabled={fetchingId === sub.id}
                title={t('subscriptions:fetch')}
                aria-label={t('subscriptions:fetch')}
                className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${fetchingId === sub.id ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={() => handleRemove(sub.id)}
                title={t('subscriptions:remove')}
                aria-label={t('subscriptions:remove')}
                className="cursor-pointer rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
