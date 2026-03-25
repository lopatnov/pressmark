import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { authClient } from '@/api/clients'
import { ConnectError } from '@connectrpc/connect'

const schema = z.object({
  newPassword:     z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})
type FormData = z.infer<typeof schema>

export function ResetPasswordPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      await authClient.resetPassword({ token, newPassword: data.newPassword })
      navigate('/login')
    } catch (err) {
      if (err instanceof ConnectError && err.code === 5 /* NotFound */) {
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
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('register.password')}</label>
            <input
              {...register('newPassword')}
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.newPassword && (
              <p className="text-xs text-destructive">{errors.newPassword.message}</p>
            )}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('resetPasswordConfirm')}</label>
            <input
              {...register('confirmPassword')}
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('resetPasswordSubmit')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          <Link to="/login" className="underline">{t('register.login')}</Link>
        </p>
      </div>
    </div>
  )
}
