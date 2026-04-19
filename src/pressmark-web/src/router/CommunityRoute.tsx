import { Navigate, Outlet } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'

export function CommunityRoute() {
  const communityPageEnabled = useAuthStore((s) => s.communityPageEnabled)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  if (!communityPageEnabled) {
    return <Navigate to={isAuthenticated ? '/feed' : '/login'} replace />
  }
  return <Outlet />
}
