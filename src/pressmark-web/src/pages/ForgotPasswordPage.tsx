import { useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { authClient } from '@/api/clients'

export function ForgotPasswordPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('forgotPasswordTitle'))
  const [submitted, setSubmitted] = useState(false)

  // Built here rather than at module scope so the validation message can be
  // translated, the same way RegisterPage builds its schema.
  const schema = useMemo(
    () => z.object({ email: z.email({ error: t('errors.invalidEmail') }) }),
    [t],
  )
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await authClient.forgotPassword({ email: data.email })
    } catch {
      // swallow errors — don't reveal if email exists
    }
    setSubmitted(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <h1 className="text-2xl font-semibold">{t('forgotPasswordTitle')}</h1>

        {submitted ? (
          <p className="text-sm text-muted-foreground">{t('forgotPasswordSuccess')}</p>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm font-medium">
                {t('login.email')}
              </label>
              <input
                id="email"
                {...register('email')}
                type="email"
                autoComplete="email"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'email-error' : undefined}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
              {errors.email && (
                <p id="email-error" className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {t('forgotPasswordSubmit')}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="underline">
            {t('register.login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
