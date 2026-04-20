import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient } from '@/api/clients'
import { toast } from 'sonner'
import { AdminPagination } from './AdminPagination'
import { AdminSkeletonRows } from './AdminSkeletonRows'
import { useAdminPaginatedList, ADMIN_PAGE_SIZE } from '@/hooks/useAdminPaginatedList'

interface HiddenItem {
  id: string
  title: string
  url: string
  sourceTitle: string
}

export default function HiddenArticlesSection() {
  const { t } = useTranslation(['admin', 'common'])

  const { items, loading, page, totalPages, handlePage, load } = useAdminPaginatedList<HiddenItem>(
    (p) =>
      adminClient.listHiddenFeedItems({ pageSize: ADMIN_PAGE_SIZE, page: p }).then((res) => ({
        items: res.items.map((item) => ({
          id: item.id,
          title: item.title,
          url: item.url,
          sourceTitle: item.sourceTitle,
        })),
        totalCount: res.totalCount,
      })),
  )

  const handleUnhide = async (id: string) => {
    try {
      await adminClient.hideFeedItem({ feedItemId: id, hidden: false })
      toast.success(t('admin:moderation.unhidden'))
      load(page)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <AdminSkeletonRows>
          {(key) => (
            <div key={key} className="flex items-center justify-between px-4 py-3">
              <div className="space-y-1.5">
                <Skeleton className="h-4 w-52" />
                <Skeleton className="h-3 w-24" />
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
          {t('admin:moderation.noHiddenArticles')}
        </p>
      )
    }
    return (
      <table className="w-full text-sm">
        <tbody>
          {items.map((item) => (
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
                    aria-label={t('admin:moderation.openArticle')}
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
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:moderation.hiddenArticles')}</h2>
      <div className="rounded-lg border border-border">{renderContent()}</div>
      <AdminPagination page={page} totalPages={totalPages} loading={loading} onPage={handlePage} />
    </section>
  )
}
