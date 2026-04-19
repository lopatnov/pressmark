import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient } from '@/api/clients'
import { useAdminStore, type InviteItem } from '@/store/adminStore'
import { toast } from 'sonner'
import { AdminPagination } from './AdminPagination'
import { AdminSkeletonRows } from './AdminSkeletonRows'

const PAGE_SIZE = 20

export default function InvitesSection() {
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
  const [generating, setGenerating] = useState(false)
  const listReqRef = useRef(0)

  const smtpConfigured = Boolean(settings?.smtpHost)

  const renderInviteList = () => {
    if (loadingList) {
      return (
        <AdminSkeletonRows>
          {(key) => (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-16" />
            </div>
          )}
        </AdminSkeletonRows>
      )
    }
    if (invites.length === 0) {
      return (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {t('admin:invites.empty')}
        </p>
      )
    }
    return (
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
    )
  }
  const noteIsValidEmail = /^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(note)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const loadList = (p: number) => {
    const req = ++listReqRef.current
    setLoadingList(true)
    adminClient
      .listInvites({ pageSize: PAGE_SIZE, page: p })
      .then((res) => {
        if (req !== listReqRef.current) return
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
      .finally(() => {
        if (req === listReqRef.current) setLoadingList(false)
      })
  }

  useEffect(() => {
    loadList(0)
  }, [])

  const handleGenerate = async () => {
    if (generating) return
    setGenerating(true)
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
    } finally {
      setGenerating(false)
    }
  }

  const handleCopy = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(token)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await adminClient.deleteInvite({ id })
      if (newToken?.id === id) setNewToken(null)
      const newPage = invites.length === 1 && page > 0 ? page - 1 : page
      setPage(newPage)
      loadList(newPage)
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
            aria-label={t('admin:invites.expiryLabel')}
            className="rounded-md border border-border bg-background px-2 py-2 text-sm"
          >
            <option value={1}>{t('admin:invites.expiry1Day')}</option>
            <option value={7}>{t('admin:invites.expiry7Days')}</option>
            <option value={30}>{t('admin:invites.expiry30Days')}</option>
            <option value={0}>{t('admin:invites.expiryNone')}</option>
          </select>
          <Button size="lg" onClick={handleGenerate} disabled={generating}>
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
            <span className={noteIsValidEmail ? '' : 'text-muted-foreground'}>
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

      <div className="rounded-lg border border-border">{renderInviteList()}</div>
      <AdminPagination
        page={page}
        totalPages={totalPages}
        loading={loadingList}
        onPage={handlePage}
      />
    </section>
  )
}
