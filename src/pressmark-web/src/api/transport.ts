import { Code, ConnectError, createClient } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'
import type { Interceptor } from '@connectrpc/connect'

// Plain transport without interceptors — used exclusively for token refresh
// to avoid an infinite loop (interceptor → refresh → interceptor → …)
const refreshTransport = createGrpcWebTransport({ baseUrl: '/grpc' })

// Deduplicates concurrent refresh attempts so only one request is in-flight at a time
let pendingRefresh: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh

  pendingRefresh = (async () => {
    try {
      const { AuthService } = await import('./generated/auth_pb')
      const { useAuthStore } = await import('../store/authStore')
      const client = createClient(AuthService, refreshTransport)
      const res = await client.refresh({})
      useAuthStore.getState().setAuth(res.accessToken, {
        id: res.userId,
        email: res.email,
        role: res.role as 'User' | 'Admin',
      })
      return res.accessToken
    } catch (error) {
      // Log refresh failure for debugging
      console.error('[transport] Token refresh failed:', error instanceof Error ? error.message : error)
      
      const { useAuthStore } = await import('../store/authStore')
      useAuthStore.getState().clearAuth()
      return null
    } finally {
      pendingRefresh = null
    }
  })()

  return pendingRefresh
}

const authInterceptor: Interceptor = (next) => async (req) => {
  // Import lazily to avoid circular deps; authStore is always available at call time
  const { useAuthStore } = await import('../store/authStore')
  const token = useAuthStore.getState().accessToken
  if (token) {
    req.header.set('Authorization', `Bearer ${token}`)
  }
  try {
    return await next(req)
  } catch (err) {
    // Skip refresh if this call IS the Refresh endpoint — prevents infinite loop
    const isRefreshCall = req.url.includes('/Refresh')
    if (err instanceof ConnectError && err.code === Code.Unauthenticated && !isRefreshCall) {
      try {
        // Try to silently refresh the access token using the httpOnly refresh cookie.
        // Only call clearAuth() (→ redirect to /login) if the refresh itself fails.
        const newToken = await refreshAccessToken()
        if (newToken) {
          // Retry the original call with the fresh token
          req.header.set('Authorization', `Bearer ${newToken}`)
          return await next(req)
        }
      } catch (refreshError) {
        // Log the refresh error and re-throw the original error
        console.error('[transport] Failed to refresh token:', refreshError instanceof Error ? refreshError.message : refreshError)
        throw err
      }
    }
    throw err
  }
}

export const transport = createGrpcWebTransport({
  baseUrl: '/grpc',
  interceptors: [authInterceptor],
})
