import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { authClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'
import { ConnectError } from '@connectrpc/connect'

const schema = z.object({
  email:       z.string().email(),
  password:    z.string().min(8, 'Minimum 8 characters'),
  inviteToken: z.string().optional(),
})
type FormData = z.infer<typeof schema>

export function RegisterPage() {
  const { t } = useTranslation('auth')
  const navigate = useNavigate()
  const setAuth  = useAuthStore((s) => s.setAuth)
  const [showInvite, setShowInvite] = useState(false)

  const { register, handleSubmit, formState: { errors, isSubmitting }, setError } =
    useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authClient.register({
        email:       data.email,
        password:    data.password,
        inviteToken: data.inviteToken ?? '',
      })
      setAuth(res.accessToken, {
        id:    res.userId,
        email: res.email,
        role:  res.role as 'User' | 'Admin',
      })
      navigate('/feed')
    } catch (err) {
      if (err instanceof ConnectError) {
        if (err.code === 7 /* FailedPrecondition */) {
          setError('root', { message: t('errors.registrationClosed') })
        } else if (err.code === 16 /* PermissionDenied */) {
          setShowInvite(true)
          setError('inviteToken', { message: t('errors.invalidInviteToken') })
        } else if (err.code === 6 /* AlreadyExists */) {
          setError('root', { message: t('errors.emailTaken') })
        } else {
          setError('root', { message: t('errors.invalidCredentials') })
        }
      } else {
        setError('root', { message: t('errors.invalidCredentials') })
      }
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="w-full max-w-sm space-y-6 p-6">
        <h1 className="text-2xl font-semibold">{t('register.title')}</h1>

        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
          {t('register.firstUserAdmin')}
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium">{t('register.email')}</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">{t('register.password')}</label>
            <input
              {...register('password')}
              type="password"
              autoComplete="new-password"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          {showInvite && (
            <div className="space-y-1">
              <label className="text-sm font-medium">{t('inviteToken')}</label>
              <input
                {...register('inviteToken')}
                type="text"
                placeholder={t('inviteTokenPlaceholder')}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm font-mono"
              />
              {errors.inviteToken && (
                <p className="text-xs text-destructive">{errors.inviteToken.message}</p>
              )}
            </div>
          )}

          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('register.submit')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="underline">{t('register.login')}</Link>
        </p>
      </div>
    </div>
  )
}
