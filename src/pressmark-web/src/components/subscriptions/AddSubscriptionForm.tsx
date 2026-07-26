import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { Code, ConnectError } from '@connectrpc/connect'
import { Button } from '@/components/ui/button'

const schema = z.object({
  rssUrl: z.string().url(),
  title: z.string().optional(),
})
type FormData = z.infer<typeof schema>

interface Props {
  readonly onAdd: (rssUrl: string, title: string) => Promise<void>
  readonly onDone: () => void
  readonly onCancel: () => void
}

export function AddSubscriptionForm({ onAdd, onDone, onCancel }: Props) {
  const { t } = useTranslation(['subscriptions', 'common'])
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
      <div className="space-y-1">
        <label htmlFor="rssUrl" className="text-sm font-medium">
          {t('subscriptions:rssUrl')}
        </label>
        <input
          id="rssUrl"
          {...register('rssUrl')}
          type="url"
          aria-invalid={!!errors.rssUrl}
          aria-describedby={errors.rssUrl ? 'rssUrl-error' : undefined}
          placeholder="https://example.com/rss.xml"
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {errors.rssUrl && (
          <p id="rssUrl-error" className="text-xs text-destructive">
            {errors.rssUrl.message}
          </p>
        )}
      </div>
      <div className="space-y-1">
        <label htmlFor="title" className="text-sm font-medium">
          {t('subscriptions:feedTitle')}
        </label>
        <input
          id="title"
          {...register('title')}
          type="text"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          placeholder={t('subscriptions:feedTitlePlaceholder')}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {errors.title && (
          <p id="title-error" className="text-xs text-destructive">
            {errors.title.message}
          </p>
        )}
      </div>
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
