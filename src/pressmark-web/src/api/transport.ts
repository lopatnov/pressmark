import { createGrpcWebTransport } from '@connectrpc/connect-web'
import type { Interceptor } from '@connectrpc/connect'

const authInterceptor: Interceptor = (next) => async (req) => {
  // Import lazily to avoid circular deps; authStore is always available at call time
  const { useAuthStore } = await import('../store/authStore')
  const token = useAuthStore.getState().accessToken
  if (token) {
    req.header.set('Authorization', `Bearer ${token}`)
  }
  return next(req)
}

export const transport = createGrpcWebTransport({
  baseUrl: '/grpc',
  interceptors: [authInterceptor],
})
