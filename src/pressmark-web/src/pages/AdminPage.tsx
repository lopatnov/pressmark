import { lazy, Suspense, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/components/ui/skeleton'
import { adminClient } from '@/api/clients'
import { useAdminStore } from '@/store/adminStore'

// Lazy load admin sections
const SiteSettingsSection = lazy(() => import('@/components/admin/SiteSettingsSection'))
const ReportsSection = lazy(() => import('@/components/admin/ReportsSection'))
const InvitesSection = lazy(() => import('@/components/admin/InvitesSection'))
const BannedSubscriptionsSection = lazy(
  () => import('@/components/admin/BannedSubscriptionsSection'),
)
const HiddenArticlesSection = lazy(() => import('@/components/admin/HiddenArticlesSection'))
const UsersSection = lazy(() => import('@/components/admin/UsersSection'))

// Loading fallback for sections
const SectionLoading = () => (
  <div className="space-y-3 rounded-lg border border-border p-4">
    <Skeleton className="h-6 w-32" />
    <Skeleton className="h-4 w-full" />
    <Skeleton className="h-4 w-3/4" />
    <Skeleton className="h-10 w-24" />
  </div>
)

export function AdminPage() {
  const { t } = useTranslation('admin')
  const { setSettings } = useAdminStore()

  useEffect(() => {
    adminClient.getSiteSettings({}).then((res) =>
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
        feedRetentionDays: res.feedRetentionDays || 90,
      }),
    )
  }, [])

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4">
      <h1 className="text-xl font-semibold">{t('title')}</h1>

      <Suspense fallback={<SectionLoading />}>
        <SiteSettingsSection />
        <ReportsSection />
        <InvitesSection />
        <BannedSubscriptionsSection />
        <HiddenArticlesSection />
        <UsersSection />
      </Suspense>
    </div>
  )
}
