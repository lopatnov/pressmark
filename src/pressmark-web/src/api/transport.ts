import { Code, ConnectError, createClient } from '@connectrpc/connect'
import { createGrpcWebTransport } from '@connectrpc/connect-web'
import type { Interceptor } from '@connectrpc/connect'

// Plain transport without interceptors — used exclusively for token refresh
// to avoid an infinite loop (interceptor → refresh → interceptor → …)
const refreshTransport = createGrpcWebTransport({ baseUrl: '/grpc' })

// Runs fn while holding a cross-tab exclusive lock so that only one browser tab
// can execute a refresh at a time. Falls back to a localStorage spin-lock for
// environments without Web Locks API support (all modern browsers have it, but
// the fallback keeps the logic sound in edge cases such as SSR or older WebViews).
function withRefreshLock(fn: () => Promise<string | null>): Promise<string | null> {
  if (typeof navigator !== 'undefined' && 'locks' in navigator) {
    return navigator.locks.request('pressmark-refresh', fn)
  }
  // localStorage fallback (best-effort spin-lock)
  return new Promise((resolve, reject) => {
    const LOCK_KEY = 'pressmark-refresh-lock'
    const LOCK_TTL = 10_000 // ms — releases stale lock left by a crashed tab

    const tryAcquire = () => {
      const held = localStorage.getItem(LOCK_KEY)
      if (held && Date.now() - Number(held) < LOCK_TTL) {
        setTimeout(tryAcquire, 50)
        return
      }
      localStorage.setItem(LOCK_KEY, String(Date.now()))
      fn()
        .then(resolve, reject)
        .finally(() => localStorage.removeItem(LOCK_KEY))
    }
    tryAcquire()
  })
}

// Deduplicates concurrent refresh attempts within the same tab (pendingRefresh)
// AND serialises refresh calls across tabs (withRefreshLock).
//
// Race scenario without the lock: two tabs simultaneously call Refresh with the
// same httpOnly cookie. The server rotates the token on first use; the second tab
// receives Unauthenticated → clearAuth() → unexpected logout.
// With the lock, Tab B waits until Tab A finishes; by then the browser has already
// applied the new Set-Cookie from Tab A's response, so Tab B's request succeeds.
let pendingRefresh: Promise<string | null> | null = null

function refreshAccessToken(): Promise<string | null> {
  if (pendingRefresh) return pendingRefresh

  pendingRefresh = withRefreshLock(async () => {
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
    } catch {
      const { useAuthStore } = await import('../store/authStore')
      useAuthStore.getState().clearAuth()
      return null
    }
  }).finally(() => {
    pendingRefresh = null
  })

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
