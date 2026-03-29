import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Code, ConnectError } from '@connectrpc/connect'
import { Button } from '@/components/ui/button'
import { authClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'
import { ArrowLeft } from 'lucide-react'

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})
type FormData = z.infer<typeof schema>

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const registrationMode = useAuthStore((s) => s.registrationMode)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authClient.login({
        email: data.email,
        password: data.password,
      })
      setAuth(res.accessToken, {
        id: res.userId,
        email: res.email,
        role: res.role as 'User' | 'Admin',
      })
      navigate('/feed')
    } catch (err) {
      const isSiteBanned =
        err instanceof ConnectError &&
        err.code === Code.PermissionDenied &&
        err.rawMessage === 'account_banned'
      setError('root', {
        message: t(isSiteBanned ? 'errors.accountBanned' : 'errors.invalidCredentials'),
      })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('login.email')}</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('login.password')}</label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('login.submit')}
          </Button>
        </form>

        <div className="space-y-1 text-center text-sm text-muted-foreground">
          {registrationMode === 'open' && (
            <p>
              {t('login.noAccount')}{' '}
              <Link to="/register" className="underline">
                {t('login.register')}
              </Link>
            </p>
          )}
          <p>
            <Link to="/forgot-password" className="underline">
              {t('login.forgotPassword')}
            </Link>
          </p>
        </div>
        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {t('common:nav.community')}
          </Link>
        </div>
      </div>
    </div>
  )
}
