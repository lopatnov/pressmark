import { useEffect, useMemo, useState, type ComponentPropsWithoutRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { adminClient } from '@/api/clients'
import { useAdminStore } from '@/store/adminStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'

export default function SiteSettingsSection() {
  const { t } = useTranslation(['admin', 'common'])
  const { settings, setSettings } = useAdminStore()
  const setCommunityPageEnabled = useAuthStore((s) => s.setCommunityPageEnabled)
  const setCommentsEnabled = useAuthStore((s) => s.setCommentsEnabled)
  const [saved, setSaved] = useState(false)

  // Built here rather than at module scope so the validation messages can be
  // translated, the same way the other forms build their schemas.
  const settingsSchema = useMemo(() => {
    const range = (min: number, max: number) =>
      z
        .number()
        .int()
        .min(min, t('admin:settings.errors.outOfRange', { min, max }))
        .max(max, t('admin:settings.errors.outOfRange', { min, max }))
    return z.object({
      siteName: z.string().min(1, t('admin:settings.errors.required')),
      siteDescription: z.string(),
      communityWindowDays: range(1, 365),
      registrationMode: z.enum(['open', 'invite_only']),
      smtpHost: z.string(),
      smtpPort: range(1, 65535),
      smtpUser: z.string(),
      smtpPassword: z.string(),
      smtpUseTls: z.boolean(),
      smtpFromAddress: z.string(),
      commentsEnabled: z.boolean(),
      feedRetentionDays: range(1, 3650),
      communityPageEnabled: z.boolean(),
    })
  }, [t])
  type SettingsForm = z.infer<typeof settingsSchema>

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
  }, [settings, reset])

  // The password is write-only: it goes to the server and nowhere else, so what
  // the admin typed never ends up in the shared store.
  const onSubmit = async ({ smtpPassword, ...stored }: SettingsForm) => {
    try {
      await adminClient.updateSiteSettings({ settings: { ...stored, smtpPassword } })
      setSettings(stored)
      setCommunityPageEnabled(stored.communityPageEnabled)
      setCommentsEnabled(stored.commentsEnabled)
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
        <FormField
          id="siteName"
          label={t('admin:settings.siteName')}
          error={errors.siteName?.message}
          {...register('siteName')}
        />

        <div className="space-y-1">
          <label htmlFor="siteDescription" className="text-sm font-medium">
            {t('admin:settings.siteDescription')}
          </label>
          <textarea
            id="siteDescription"
            {...register('siteDescription')}
            rows={2}
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm resize-none"
          />
        </div>

        <FormField
          id="communityWindowDays"
          label={t('admin:settings.communityWindowDays')}
          type="number"
          min={1}
          max={365}
          className="w-32"
          error={errors.communityWindowDays?.message}
          {...register('communityWindowDays', { valueAsNumber: true })}
        />

        <div className="space-y-1">
          <label htmlFor="registrationMode" className="text-sm font-medium">
            {t('admin:settings.registrationMode')}
          </label>
          <select
            id="registrationMode"
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
            <FormField
              id="smtpHost"
              label={t('admin:settings.smtpHost')}
              placeholder="smtp.example.com"
              {...register('smtpHost')}
            />
            <FormField
              id="smtpPort"
              label={t('admin:settings.smtpPort')}
              type="number"
              min={1}
              max={65535}
              error={errors.smtpPort?.message}
              {...register('smtpPort', { valueAsNumber: true })}
            />
          </div>

          <FormField
            id="smtpUser"
            label={t('admin:settings.smtpUser')}
            autoComplete="off"
            {...register('smtpUser')}
          />
          <FormField
            id="smtpPassword"
            label={t('admin:settings.smtpPassword')}
            type="password"
            autoComplete="new-password"
            placeholder={t('admin:settings.smtpPasswordPlaceholder')}
            {...register('smtpPassword')}
          />
          <FormField
            id="smtpFromAddress"
            label={t('admin:settings.smtpFromAddress')}
            type="email"
            placeholder="noreply@example.com"
            {...register('smtpFromAddress')}
          />

          <CheckboxField label={t('admin:settings.smtpUseTls')} {...register('smtpUseTls')} />
        </div>

        <div className="border-t border-border pt-3 space-y-2">
          <CheckboxField
            label={t('admin:settings.communityPageEnabled')}
            {...register('communityPageEnabled')}
          />
          <CheckboxField
            label={t('admin:settings.commentsEnabled')}
            {...register('commentsEnabled')}
          />
        </div>

        <FormField
          id="feedRetentionDays"
          label={t('admin:settings.feedRetentionDays')}
          type="number"
          min={1}
          max={3650}
          className="w-32"
          error={errors.feedRetentionDays?.message}
          {...register('feedRetentionDays', { valueAsNumber: true })}
        />
        <div className="space-y-1">
          <Button type="button" size="sm" variant="outline" onClick={handleClearOldFeeds}>
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

interface CheckboxFieldProps extends ComponentPropsWithoutRef<'input'> {
  readonly label: string
}

/** A checkbox with its label wrapped around it, so it needs no id to be labelled. */
function CheckboxField({ label, ...inputProps }: CheckboxFieldProps) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
      <input type="checkbox" className="h-4 w-4" {...inputProps} />
      {label}
    </label>
  )
}
