import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient } from '@/api/clients'
import { toast } from 'sonner'
import { AdminPagination } from './AdminPagination'
import { AdminSkeletonRows } from './AdminSkeletonRows'

const PAGE_SIZE = 20

export default function BannedSubscriptionsSection() {
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

  const renderContent = () => {
    if (loading) {
      return (
        <AdminSkeletonRows>
          {(key) => (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-36" />
                <Skeleton className="h-3 w-52" />
              </div>
              <Skeleton className="h-8 w-16" />
            </div>
          )}
        </AdminSkeletonRows>
      )
    }
    if (items.length === 0) {
      return (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {t('admin:bannedSubs.empty')}
        </p>
      )
    }
    return (
      <table className="w-full text-sm">
        <tbody>
          {items.map((sub) => (
            <tr key={sub.id} className="border-b border-border last:border-0">
              <td className="px-4 py-2">
                <p className="font-medium">{sub.title || sub.rssUrl}</p>
                {sub.title && (
                  <p className="text-xs text-muted-foreground truncate max-w-xs">{sub.rssUrl}</p>
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
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:bannedSubs.title')}</h2>
      <div className="rounded-lg border border-border">{renderContent()}</div>
      <AdminPagination page={page} totalPages={totalPages} loading={loading} onPage={handlePage} />
    </section>
  )
}
