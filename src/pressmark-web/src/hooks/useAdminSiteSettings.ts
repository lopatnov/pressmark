import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { adminClient } from '@/api/clients'
import { useAdminStore } from '@/store/adminStore'

/** Server defaults applied when the backend has never had the value set. */
const DEFAULT_SMTP_PORT = 587
const DEFAULT_FEED_RETENTION_DAYS = 90

/**
 * Loads the site settings into the admin store, leaving AdminPage with layout
 * only. The settings are consumed by SiteSettingsSection (the edit form) and by
 * InvitesSection (which needs to know whether SMTP is configured).
 */
export function useAdminSiteSettings() {
  const { t } = useTranslation(['admin', 'common'])
  const setSettings = useAdminStore((s) => s.setSettings)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setFailed(false)
    adminClient
      .getSiteSettings({})
      .then((res) => {
        if (cancelled) return
        setSettings({
          siteName: res.siteName,
          siteDescription: res.siteDescription,
          communityWindowDays: res.communityWindowDays,
          registrationMode: res.registrationMode as 'open' | 'invite_only',
          smtpHost: res.smtpHost,
          smtpPort: res.smtpPort || DEFAULT_SMTP_PORT,
          smtpUser: res.smtpUser,
          smtpPassword: '', // write-only — never echoed back by the server
          smtpUseTls: res.smtpUseTls,
          smtpFromAddress: res.smtpFromAddress,
          commentsEnabled: res.commentsEnabled,
          feedRetentionDays: res.feedRetentionDays || DEFAULT_FEED_RETENTION_DAYS,
          communityPageEnabled: res.communityPageEnabled,
        })
      })
      .catch(() => {
        if (cancelled) return
        setFailed(true)
        toast.error(t('common:error'))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [setSettings, t])

  return { loading, failed }
}
