import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Download, Plus, Trash2, Upload } from 'lucide-react'
import { ConnectError } from '@connectrpc/connect'
import { Button } from '@/components/ui/button'
import { subscriptionClient } from '@/api/clients'
import { useSubscriptionStore } from '@/store/subscriptionStore'

const schema = z.object({
  rssUrl: z.string().url(),
  title:  z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function SubscriptionsPage() {
  const { t } = useTranslation(['subscriptions', 'common'])
  const { subscriptions, isLoading, setSubscriptions, addSubscription, removeSubscription, setLoading } =
    useSubscriptionStore()
  const [showForm, setShowForm] = useState(false)
  const [importStatus, setImportStatus] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError, reset } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  useEffect(() => {
    setLoading(true)
    subscriptionClient.listSubscriptions({})
      .then((res) => {
        setSubscriptions(res.subscriptions.map((s) => ({
          id:            s.id,
          rssUrl:        s.rssUrl,
          title:         s.title,
          lastFetchedAt: s.lastFetchedAt,
          createdAt:     s.createdAt,
        })))
      })
      .finally(() => setLoading(false))
  }, [])

  const onSubmit = async (data: FormData) => {
    try {
      const sub = await subscriptionClient.addSubscription({ rssUrl: data.rssUrl, title: data.title ?? '' })
      addSubscription({ id: sub.id, rssUrl: sub.rssUrl, title: sub.title, lastFetchedAt: sub.lastFetchedAt, createdAt: sub.createdAt })
      reset()
      setShowForm(false)
    } catch (err) {
      if (err instanceof ConnectError && err.code === 3 /* InvalidArgument */) {
        setError('rssUrl', { message: t('subscriptions:errors.fetchFailed') })
      } else {
        setError('root', { message: t('common:error') })
      }
    }
  }

  const handleExport = async () => {
    try {
      const res = await subscriptionClient.exportSubscriptions({})
      const blob = new Blob([res.opmlContent], { type: 'text/xml' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = 'subscriptions.opml'
      a.click()
      URL.revokeObjectURL(url)
    } catch {}
  }

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const opmlContent = ev.target?.result as string
      try {
        const res = await subscriptionClient.importSubscriptions({ opmlContent })
        setImportStatus(t('subscriptions:importSuccess', {
          imported: res.imported,
          skipped:  res.skipped,
        }))
        // Refresh the list
        const list = await subscriptionClient.listSubscriptions({})
        setSubscriptions(list.subscriptions.map((s) => ({
          id: s.id, rssUrl: s.rssUrl, title: s.title,
          lastFetchedAt: s.lastFetchedAt, createdAt: s.createdAt,
        })))
      } catch {
        setImportStatus(t('subscriptions:importError'))
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  const handleRemove = async (id: string) => {
    if (!confirm(t('subscriptions:removeConfirm'))) return
    removeSubscription(id)
    await subscriptionClient.removeSubscription({ subscriptionId: id }).catch(() => {})
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{t('subscriptions:title')}</h1>
        <div className="flex gap-2">
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

      {importStatus && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">{importStatus}</p>
      )}

      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 rounded-lg border border-border p-4">
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
            <Button type="submit" size="sm" disabled={isSubmitting}>{t('common:save')}</Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>
              {t('common:cancel')}
            </Button>
          </div>
        </form>
      )}

      {isLoading && (
        <p className="text-center text-sm text-muted-foreground">{t('common:loading')}</p>
      )}

      {!isLoading && subscriptions.length === 0 && (
        <p className="py-12 text-center text-sm text-muted-foreground">{t('subscriptions:empty')}</p>
      )}

      <div className="space-y-2">
        {subscriptions.map((sub) => (
          <div key={sub.id} className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
            <div className="min-w-0 space-y-0.5">
              <p className="truncate text-sm font-medium">{sub.title}</p>
              <p className="truncate text-xs text-muted-foreground">{sub.rssUrl}</p>
              {sub.lastFetchedAt && (
                <p className="text-xs text-muted-foreground">
                  {t('subscriptions:lastFetched')}: {new Date(sub.lastFetchedAt).toLocaleString()}
                </p>
              )}
            </div>
            <button
              onClick={() => handleRemove(sub.id)}
              className="ml-3 rounded p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
