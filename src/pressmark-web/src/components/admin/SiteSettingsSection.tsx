import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { adminClient } from '@/api/clients'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'

const settingsSchema = z.object({
  siteName: z.string().min(1),
  communityWindowDays: z.number().int().min(1).max(365),
  registrationMode: z.enum(['open', 'invite_only']),
  smtpHost: z.string(),
  smtpPort: z.number().int().min(1).max(65535),
  smtpUser: z.string(),
  smtpPassword: z.string(),
  smtpUseTls: z.boolean(),
  smtpFromAddress: z.string(),
  commentsEnabled: z.boolean(),
  feedRetentionDays: z.number().int().min(1).max(3650),
  communityPageEnabled: z.boolean(),
})
type SettingsForm = z.infer<typeof settingsSchema>

export default function SiteSettingsSection() {
  const { t } = useTranslation(['admin', 'common'])
  const { settings, setSettings } = useAdminStore()
  const setCommunityPageEnabled = useAuthStore((s) => s.setCommunityPageEnabled)
  const setCommentsEnabled = useAuthStore((s) => s.setCommentsEnabled)
  const [saved, setSaved] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SettingsForm>({ resolver: zodResolver(settingsSchema) })

  useEffect(() => {
    if (settings)
      reset({
        ...settings,
        smtpPassword: '', // never pre-fill the password field
      })
  }, [settings])

  const onSubmit = async (data: SettingsForm) => {
    try {
      await adminClient.updateSiteSettings({
        settings: {
          siteName: data.siteName,
          communityWindowDays: data.communityWindowDays,
          registrationMode: data.registrationMode,
          smtpHost: data.smtpHost,
          smtpPort: data.smtpPort,
          smtpUser: data.smtpUser,
          smtpPassword: data.smtpPassword,
          smtpUseTls: data.smtpUseTls,
          smtpFromAddress: data.smtpFromAddress,
          commentsEnabled: data.commentsEnabled,
          feedRetentionDays: data.feedRetentionDays,
          communityPageEnabled: data.communityPageEnabled,
        },
      })
      setSettings(data)
      setCommunityPageEnabled(data.communityPageEnabled)
      setCommentsEnabled(data.commentsEnabled)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      toast.error(t('common:error'))
    }
  }

  const handleClearOldFeeds = async () => {
    try {
      await adminClient.clearOldFeeds({})
      toast.success(t('admin:settings.oldFeedsCleared'))
    } catch {
      toast.error(t('common:error'))
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-base font-semibold">{t('admin:settings.title')}</h2>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-3 rounded-lg border border-border p-4"
      >
        <div className="space-y-1">
          <label className="text-sm font-medium">{t('admin:settings.siteName')}</label>
          <input
            {...register('siteName')}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {errors.siteName && <p className="text-xs text-destructive">{errors.siteName.message}</p>}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('admin:settings.communityWindowDays')}</label>
          <input
            {...register('communityWindowDays', { valueAsNumber: true })}
            type="number"
            min={1}
            max={365}
            className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {errors.communityWindowDays && (
            <p className="text-xs text-destructive">{errors.communityWindowDays.message}</p>
          )}
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium">{t('admin:settings.registrationMode')}</label>
          <select
            {...register('registrationMode')}
            className="rounded-md border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="open">{t('admin:settings.open')}</option>
            <option value="invite_only">{t('admin:settings.inviteOnly')}</option>
          </select>
        </div>

        <div className="border-t border-border pt-3 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">{t('admin:settings.smtp')}</p>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('admin:settings.smtpHost')}</label>
              <input
                {...register('smtpHost')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                placeholder="smtp.example.com"
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('admin:settings.smtpPort')}</label>
              <input
                {...register('smtpPort', { valueAsNumber: true })}
                type="number"
                min={1}
                max={65535}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('admin:settings.smtpUser')}</label>
            <input
              {...register('smtpUser')}
              autoComplete="off"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('admin:settings.smtpPassword')}</label>
            <input
              {...register('smtpPassword')}
              type="password"
              autoComplete="new-password"
              placeholder={t('admin:settings.smtpPasswordPlaceholder')}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('admin:settings.smtpFromAddress')}</label>
            <input
              {...register('smtpFromAddress')}
              type="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              placeholder="noreply@example.com"
            />
          </div>

          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input {...register('smtpUseTls')} type="checkbox" className="h-4 w-4" />
            {t('admin:settings.smtpUseTls')}
          </label>
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input {...register('communityPageEnabled')} type="checkbox" className="h-4 w-4" />
            {t('admin:settings.communityPageEnabled')}
          </label>
          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input {...register('commentsEnabled')} type="checkbox" className="h-4 w-4" />
            {t('admin:settings.commentsEnabled')}
          </label>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium  pr-2">
            {t('admin:settings.feedRetentionDays')}
          </label>
          <input
            {...register('feedRetentionDays', { valueAsNumber: true })}
            type="number"
            min={1}
            max={3650}
            className="w-32 rounded-md border border-border bg-background px-3 py-2 text-sm"
          />
          {errors.feedRetentionDays && (
            <p className="text-xs text-destructive">{errors.feedRetentionDays.message}</p>
          )}
        </div>
        <div className="space-y-1">
          <Button type="button" size="sm" variant="outline" onClick={() => handleClearOldFeeds()}>
            {t('admin:settings.clearOldFeedsNow')}
          </Button>
        </div>

        <div className="flex items-center gap-3">
          <Button type="submit" size="sm" disabled={isSubmitting || !settings}>
            {t('common:save')}
          </Button>
          {saved && <span className="text-xs text-green-600">{t('admin:settings.saved')}</span>}
        </div>
      </form>
    </section>
  )
}
