import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient } from '@/api/clients'
import { toast } from 'sonner'

const PAGE_SIZE = 20

interface UserRow {
  id: string
  email: string
  role: string
  createdAt: string
  isCommentingBanned: boolean
  isSiteBanned: boolean
}

export default function UsersSection() {
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
          <div className="divide-y divide-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3">
                <Skeleton className="h-4 w-40 shrink-0" />
                <Skeleton className="h-5 w-12 shrink-0" />
                <Skeleton className="h-4 w-20 shrink-0" />
                <Skeleton className="h-8 w-24 shrink-0" />
                <Skeleton className="h-8 w-20 shrink-0" />
                <Skeleton className="ml-auto h-4 w-16 shrink-0" />
              </div>
            ))}
          </div>
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
