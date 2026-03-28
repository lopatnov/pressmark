import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/authStore'
import { authClient } from '@/api/clients'

export function RootLayout() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setInitialized = useAuthStore((s) => s.setInitialized)
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const setRegistrationMode = useAuthStore((s) => s.setRegistrationMode)
  const setCommunityWindowDays = useAuthStore((s) => s.setCommunityWindowDays)

  useEffect(() => {
    authClient
      .getRegistrationStatus({})
      .then((res) => {
        setRegistrationMode(res.registrationMode as 'open' | 'invite_only')
        if (res.communityWindowDays > 0) setCommunityWindowDays(res.communityWindowDays)
      })
      .catch(() => {})

    authClient
      .refresh({})
      .then((res) => {
        setAuth(res.accessToken, {
          id: res.userId,
          email: res.email,
          role: res.role as 'User' | 'Admin',
        })
      })
      .catch(() => clearAuth())
      .finally(() => setInitialized())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!isInitialized) return null

  return (
    <>
      <Outlet />
      <Toaster richColors closeButton />
    </>
  )
}
