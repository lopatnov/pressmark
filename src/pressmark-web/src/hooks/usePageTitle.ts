import { useEffect } from 'react'
import { useAuthStore } from '@/store/authStore'

export function usePageTitle(pageTitle: string) {
  const siteName = useAuthStore((s) => s.siteName)
  useEffect(() => {
    document.title = `${siteName} - ${pageTitle}`
    return () => {
      document.title = siteName
    }
  }, [siteName, pageTitle])
}
