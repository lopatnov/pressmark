import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient } from '@/api/clients'
import { toast } from 'sonner'
import { AdminPagination } from './AdminPagination'
import { AdminSkeletonRows } from './AdminSkeletonRows'

const PAGE_SIZE = 20

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

export default function ReportsSection() {
  const { t } = useTranslation(['admin', 'common'])
  const [reports, setReports] = useState<ReportItem[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const reqRef = useRef(0)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const load = (p: number) => {
    const req = ++reqRef.current
    setLoading(true)
    adminClient
      .listReports({ pageSize: PAGE_SIZE, page: p })
      .then((res) => {
        if (req !== reqRef.current) return
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
      .finally(() => {
        if (req === reqRef.current) setLoading(false)
      })
  }

  useEffect(() => {
    load(0)
  }, [])

  const handleResolve = async (id: string) => {
    try {
      await adminClient.resolveReport({ id })
      const remaining = reports.filter((r) => r.id !== id)
      if (remaining.length === 0 && page > 0) {
        const newPage = page - 1
        setPage(newPage)
        load(newPage)
      } else {
        setReports(remaining)
        setTotalCount((c) => c - 1)
      }
    } catch {
      toast.error(t('admin:reports.resolveError'))
    }
  }

  const handlePage = (p: number) => {
    setPage(p)
    load(p)
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="overflow-x-auto rounded-lg border border-border">
          <AdminSkeletonRows>
            {(key) => (
              <div key={key} className="flex items-start gap-4 px-4 py-3">
                <div className="min-w-[7rem] space-y-1.5">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-36" />
                </div>
                <div className="min-w-[8rem] space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
                <Skeleton className="ml-auto h-8 w-16 flex-shrink-0" />
              </div>
            )}
          </AdminSkeletonRows>
        </div>
      )
    }
    if (reports.length === 0) {
      return <p className="text-sm text-muted-foreground">{t('admin:reports.empty')}</p>
    }
    return (
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
                  <div className="text-xs text-muted-foreground min-w-[8rem]">
                    <p className="text-xs text-muted-foreground line-clamp-2">{r.content || '—'}</p>
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
    )
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-medium">{t('admin:reports.title')}</h2>
      {renderContent()}
      <AdminPagination page={page} totalPages={totalPages} loading={loading} onPage={handlePage} />
    </section>
  )
}
