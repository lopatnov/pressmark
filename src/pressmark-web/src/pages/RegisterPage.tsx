import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { usePageTitle } from '@/hooks/usePageTitle'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormField } from '@/components/ui/form-field'
import { authClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'
import { Code, ConnectError } from '@connectrpc/connect'

export function RegisterPage() {
  const { t } = useTranslation(['auth', 'common'])
  usePageTitle(t('auth:register.title'))
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tokenFromUrl = searchParams.get('invite_token') ?? ''
  const setAuth = useAuthStore((s) => s.setAuth)
  const registrationMode = useAuthStore((s) => s.registrationMode)
  const communityPageEnabled = useAuthStore((s) => s.communityPageEnabled)
  const [showInvite, setShowInvite] = useState(registrationMode === 'invite_only' || !!tokenFromUrl)
  const [isFirstUser, setIsFirstUser] = useState(false)

  useEffect(() => {
    authClient
      .getRegistrationStatus({})
      .then((res) => {
        setIsFirstUser(!res.hasAdmin)
        if (res.registrationMode === 'invite_only') setShowInvite(true)
      })
      .catch(() => {
        // intentional — banner is informational, failure is non-critical
      })
  }, [])

  const schema = useMemo(
    () =>
      z.object({
        email: z.email({ error: t('errors.invalidEmail') }),
        password: z.string().min(8, t('errors.passwordTooShort')),
        inviteToken: z.string().optional(),
      }),
    [t],
  )
  type FormData = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { inviteToken: tokenFromUrl },
  })

  const onSubmit = async (data: FormData) => {
    try {
      const res = await authClient.register({
        email: data.email,
        password: data.password,
        inviteToken: data.inviteToken ?? '',
      })
      setAuth(res.accessToken, {
        id: res.userId,
        email: res.email,
        role: res.role as 'User' | 'Admin',
      })
      navigate('/feed')
    } catch (err) {
      if (err instanceof ConnectError) {
        if (err.code === Code.PermissionDenied) {
          // invite_only mode: invite token missing or invalid
          setShowInvite(true)
          setError('inviteToken', { message: t('errors.invalidInviteToken') })
        } else if (err.code === Code.FailedPrecondition) {
          // registration mode is neither open nor invite_only
          setError('root', { message: t('errors.registrationClosed') })
        } else if (err.code === Code.AlreadyExists) {
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

        {isFirstUser && (
          <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {t('register.firstUserAdmin')}
          </p>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            id="email"
            label={t('register.email')}
            type="email"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          <FormField
            id="password"
            label={t('register.password')}
            type="password"
            autoComplete="new-password"
            error={errors.password?.message}
            {...register('password')}
          />

          {showInvite && (
            <div className="space-y-1">
              {registrationMode === 'invite_only' && (
                <p className="text-sm text-muted-foreground">{t('inviteOnlyHint')}</p>
              )}
              <FormField
                id="inviteToken"
                label={t('inviteToken')}
                type="text"
                placeholder={t('inviteTokenPlaceholder')}
                className="font-mono"
                error={errors.inviteToken?.message}
                {...register('inviteToken')}
              />
            </div>
          )}

          {errors.root && <p className="text-sm text-destructive">{errors.root.message}</p>}

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {t('register.submit')}
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          {t('register.hasAccount')}{' '}
          <Link to="/login" className="underline">
            {t('register.login')}
          </Link>
        </p>
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
