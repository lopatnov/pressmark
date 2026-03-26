import { ConnectError, createClient } from '@connectrpc/connect'
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
      const { AuthService } = await import('./generated/auth_connect')
      const { useAuthStore } = await import('../store/authStore')
      const client = createClient(AuthService, refreshTransport)
      const res = await client.refresh({})
      useAuthStore.getState().setAuth(res.accessToken, {
        id:    res.userId,
        email: res.email,
        role:  res.role as 'User' | 'Admin',
      })
      return res.accessToken
    } catch {
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
    if (err instanceof ConnectError && err.code === 16 /* Unauthenticated */ && !isRefreshCall) {
      // Try to silently refresh the access token using the httpOnly refresh cookie.
      // Only call clearAuth() (→ redirect to /login) if the refresh itself fails.
      const newToken = await refreshAccessToken()
      if (newToken) {
        // Retry the original call with the fresh token
        req.header.set('Authorization', `Bearer ${newToken}`)
        return await next(req)
      }
    }
    throw err
  }
}

export const transport = createGrpcWebTransport({
  baseUrl: '/grpc',
  interceptors: [authInterceptor],
})
