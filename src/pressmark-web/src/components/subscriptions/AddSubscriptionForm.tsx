import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Code, ConnectError } from '@connectrpc/connect'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'

interface Props {
  readonly onAdd: (rssUrl: string, title: string) => Promise<void>
  readonly onDone: () => void
  readonly onCancel: () => void
}

export function AddSubscriptionForm({ onAdd, onDone, onCancel }: Props) {
  const { t } = useTranslation(['subscriptions', 'common'])

  // Built here rather than at module scope so the validation message can be
  // translated, the same way ResetPasswordPage builds its schema.
  const schema = useMemo(
    () =>
      z.object({
        rssUrl: z.url({ error: t('subscriptions:errors.invalidUrl') }),
        title: z.string().optional(),
      }),
    [t],
  )
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
    reset,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await onAdd(data.rssUrl, data.title ?? '')
      reset()
      onDone()
    } catch (err) {
      // A rejected feed URL belongs on the field; anything else is a form-level error
      if (err instanceof ConnectError && err.code === Code.InvalidArgument) {
        setError('rssUrl', { message: err.message || t('subscriptions:errors.fetchFailed') })
      } else {
        setError('root', { message: t('common:error') })
      }
    }
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-3 rounded-lg border border-border p-4"
    >
      <FormField
        id="rssUrl"
        label={t('subscriptions:rssUrl')}
        type="url"
        placeholder="https://example.com/rss.xml"
        error={errors.rssUrl?.message}
        {...register('rssUrl')}
      />
      <FormField
        id="title"
        label={t('subscriptions:feedTitle')}
        type="text"
        placeholder={t('subscriptions:feedTitlePlaceholder')}
        error={errors.title?.message}
        {...register('title')}
      />
      {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={isSubmitting}>
          {t('common:save')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('common:cancel')}
        </Button>
      </div>
    </form>
  )
}
