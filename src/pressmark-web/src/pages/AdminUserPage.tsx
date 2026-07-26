import { useParams, Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { usePageTitle } from '@/hooks/usePageTitle'
import { useAdminUserDetails } from '@/hooks/useAdminUserDetails'
import { UserProfileCard } from '@/components/admin/UserProfileCard'
import { UserSubscriptionsSection } from '@/components/admin/UserSubscriptionsSection'
import { UserCommentsSection } from '@/components/admin/UserCommentsSection'

export function AdminUserPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useTranslation(['admin', 'common'])
  usePageTitle(t('admin:users.profileTitle'))

  const {
    details,
    loading,
    changeRole,
    toggleSiteBan,
    toggleSubscriptionBan,
    removeComment,
    deleteUser,
  } = useAdminUserDetails(id)

  const handleDelete = async () => {
    if (await deleteUser()) navigate('/admin')
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">{t('common:loading')}</p>
      </div>
    )
  }

  if (!details) {
    return (
      <div className="mx-auto max-w-2xl p-4">
        <p className="text-sm text-muted-foreground">{t('admin:users.notFound')}</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center gap-2">
        <Link to="/admin" className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <h1 className="text-xl font-semibold">{t('admin:users.profileTitle')}</h1>
      </div>

      <UserProfileCard
        details={details}
        onChangeRole={changeRole}
        onToggleSiteBan={toggleSiteBan}
        onDelete={handleDelete}
      />

      <UserSubscriptionsSection
        subscriptions={details.subscriptions}
        onToggleBan={toggleSubscriptionBan}
      />

      <UserCommentsSection comments={details.comments} onRemove={removeComment} />
    </div>
  )
}
