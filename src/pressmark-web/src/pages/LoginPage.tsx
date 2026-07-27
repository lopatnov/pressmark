import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { Code, ConnectError } from '@connectrpc/connect'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { authClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'
import { ArrowLeft } from 'lucide-react'

export function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  usePageTitle(t('auth:login.title'))
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const registrationMode = useAuthStore((s) => s.registrationMode)
  const communityPageEnabled = useAuthStore((s) => s.communityPageEnabled)

  // Built here rather than at module scope so the validation messages can be
  // translated, the same way RegisterPage builds its schema.
  const schema = useMemo(
    () =>
      z.object({
        email: z.email({ error: t('errors.invalidEmail') }),
        password: z.string().min(1, t('errors.passwordRequired')),
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
      let key = 'errors.invalidCredentials'
      if (err instanceof ConnectError) {
        if (err.code === Code.PermissionDenied && err.rawMessage === 'account_banned') {
          key = 'errors.accountBanned'
        } else if (err.code === Code.Unavailable) {
          key = 'errors.tooManyRequests'
        }
      }
      setError('root', { message: t(key) })
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <h1 className="text-2xl font-semibold">{t('login.title')}</h1>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            id="email"
            label={t('login.email')}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <FormField
            id="password"
            label={t('login.password')}
            type="password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register('password')}
          />

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
        {communityPageEnabled && (
          <div className="text-center">
            <Link
              to="/"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              {t('common:nav.community')}
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
