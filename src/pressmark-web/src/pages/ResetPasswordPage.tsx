import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { authClient } from '@/api/clients'
import { Code, ConnectError } from '@connectrpc/connect'

export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  usePageTitle(t('resetPasswordTitle'))
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const schema = useMemo(
    () =>
      z
        .object({
          newPassword: z.string().min(8, t('errors.passwordTooShort')),
          confirmPassword: z.string(),
        })
        .refine((d) => d.newPassword === d.confirmPassword, {
          message: t('errors.passwordsDoNotMatch'),
          path: ['confirmPassword'],
        }),
    [t],
  )
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await authClient.resetPassword({ token, newPassword: data.newPassword })
      navigate('/login')
    } catch (err) {
      if (err instanceof ConnectError && err.code === Code.NotFound) {
        setError('root', { message: t('errors.invalidResetToken') })
      } else {
        setError('root', { message: t('errors.invalidCredentials') })
      }
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-destructive">{t('errors.invalidResetToken')}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <h1 className="text-2xl font-semibold">{t('resetPasswordTitle')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            id="newPassword"
            label={t('register.password')}
            type="password"
            autoComplete="new-password"
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          <FormField
            id="confirmPassword"
            label={t('resetPasswordConfirm')}
            type="password"
            autoComplete="new-password"
            error={errors.confirmPassword?.message}
            {...register('confirmPassword')}
          />

          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('resetPasswordSubmit')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="underline">
            {t('register.login')}
          </Link>
        </p>
      </div>
    </div>
  )
}
