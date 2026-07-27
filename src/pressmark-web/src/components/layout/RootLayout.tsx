import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from '@/components/ui/sonner'
import { useAuthStore } from '@/store/authStore'
import { authClient } from '@/api/clients'

/** Shape of the plain-REST `/api/meta` document used to seed the page metadata. */
interface SiteMeta {
  siteName: string
  siteDescription: string
  baseUrl: string
}

export function RootLayout() {
  const setAuth = useAuthStore((s) => s.setAuth)
  const clearAuth = useAuthStore((s) => s.clearAuth)
  const setInitialized = useAuthStore((s) => s.setInitialized)
  const isInitialized = useAuthStore((s) => s.isInitialized)
  const setRegistrationMode = useAuthStore((s) => s.setRegistrationMode)
  const setCommunityWindowDays = useAuthStore((s) => s.setCommunityWindowDays)
  const setCommentsEnabled = useAuthStore((s) => s.setCommentsEnabled)
  const setCommunityPageEnabled = useAuthStore((s) => s.setCommunityPageEnabled)
  const setSiteName = useAuthStore((s) => s.setSiteName)
  const setSiteDescription = useAuthStore((s) => s.setSiteDescription)

  useEffect(() => {
    fetch('/api/meta')
      .then((r) => {
        // A non-2xx response still parses as JSON when the server returns an
        // error document, which would blank out the site name.
        if (!r.ok) throw new Error(`meta request failed: ${r.status}`)
        return r.json() as Promise<SiteMeta>
      })
      .then((data) => {
        setSiteName(data.siteName)
        setSiteDescription(data.siteDescription)
        const setMeta = (selector: string, content: string) =>
          document.querySelector(selector)?.setAttribute('content', content)
        setMeta('meta[name="description"]', data.siteDescription)
        setMeta('meta[property="og:title"]', data.siteName)
        setMeta('meta[property="og:description"]', data.siteDescription)
        setMeta('meta[property="og:url"]', data.baseUrl)
        setMeta('meta[name="twitter:title"]', data.siteName)
        setMeta('meta[name="twitter:description"]', data.siteDescription)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const statusPromise = authClient
      .getRegistrationStatus({})
      .then((res) => {
        setRegistrationMode(res.registrationMode as 'open' | 'invite_only')
        if (res.communityWindowDays > 0) setCommunityWindowDays(res.communityWindowDays)
        setCommentsEnabled(res.commentsEnabled)
        setCommunityPageEnabled(res.communityPageEnabled)
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
      .finally(() => statusPromise.then(() => setInitialized()))
  }, [])

  if (!isInitialized) return null

  return (
    <>
      <Outlet />
      <Toaster richColors closeButton />
    </>
  )
}
