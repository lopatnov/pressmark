import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient } from '@/api/clients'
import { toast } from 'sonner'
import { AdminListPanel } from './AdminListPanel'
import { AdminPagination } from './AdminPagination'
import { useAdminPaginatedList, ADMIN_PAGE_SIZE } from '@/hooks/useAdminPaginatedList'

interface BannedSub {
  id: string
  rssUrl: string
  title: string
}

export default function BannedSubscriptionsSection() {
  const { t } = useTranslation(['admin', 'common'])

  const { items, loading, page, totalPages, handlePage, removeItem } =
    useAdminPaginatedList<BannedSub>((p) =>
      adminClient.listBannedSubscriptions({ pageSize: ADMIN_PAGE_SIZE, page: p }).then((res) => ({
        items: res.items.map((b) => ({ id: b.id, rssUrl: b.rssUrl, title: b.title })),
        totalCount: res.totalCount,
      })),
    )

  const handleUnban = async (id: string) => {
    try {
      await adminClient.banSubscription({ subscriptionId: id, banned: false })
      removeItem(id)
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:bannedSubs.title')}</h2>
      <AdminListPanel
        loading={loading}
        isEmpty={items.length === 0}
        emptyMessage={t('admin:bannedSubs.empty')}
        skeletonRow={(key) => (
          <div key={key} className="flex items-center justify-between px-4 py-3">
            <div className="space-y-1.5">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-52" />
            </div>
            <Skeleton className="h-8 w-16" />
          </div>
        )}
      >
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
      </AdminListPanel>
      <AdminPagination page={page} totalPages={totalPages} loading={loading} onPage={handlePage} />
    </section>
  )
}
