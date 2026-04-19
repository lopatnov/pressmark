/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'
import { Skeleton } from '@/components/ui/skeleton'

// Public pages (keep synchronous for fast initial load)
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { ForgotPasswordPage } from '@/pages/ForgotPasswordPage'
import { ResetPasswordPage } from '@/pages/ResetPasswordPage'

// Lazy load non-critical pages
const CommunityPage = lazy(() =>
  import('@/pages/CommunityPage').then((module) => ({ default: module.CommunityPage })),
)
const FeedPage = lazy(() =>
  import('@/pages/FeedPage').then((module) => ({ default: module.FeedPage })),
)
const SubscriptionsPage = lazy(() =>
  import('@/pages/SubscriptionsPage').then((module) => ({ default: module.SubscriptionsPage })),
)
const BookmarksPage = lazy(() =>
  import('@/pages/BookmarksPage').then((module) => ({ default: module.BookmarksPage })),
)
const AdminPage = lazy(() =>
  import('@/pages/AdminPage').then((module) => ({ default: module.AdminPage })),
)
const AdminUserPage = lazy(() =>
  import('@/pages/AdminUserPage').then((module) => ({ default: module.AdminUserPage })),
)
const ArticlePage = lazy(() =>
  import('@/pages/ArticlePage').then((module) => ({ default: module.ArticlePage })),
)

// Suspense fallback component
const RouteLoading = () => {
  const { t } = useTranslation('common')
  return (
    <div className="flex items-center justify-center p-8">
      <Skeleton className="h-8 w-8 rounded-full" />
      <span className="ml-2 text-sm text-muted-foreground">{t('loading')}</span>
    </div>
  )
}

// Wrapper component for lazy routes with Suspense
const withSuspense = (Component: React.LazyExoticComponent<React.ComponentType<unknown>>) => {
  return (props: Record<string, unknown>) => (
    <Suspense fallback={<RouteLoading />}>
      <Component {...props} />
    </Suspense>
  )
}

// Create wrapped components
const CommunityPageWithSuspense = withSuspense(CommunityPage)
const FeedPageWithSuspense = withSuspense(FeedPage)
const SubscriptionsPageWithSuspense = withSuspense(SubscriptionsPage)
const BookmarksPageWithSuspense = withSuspense(BookmarksPage)
const AdminPageWithSuspense = withSuspense(AdminPage)
const AdminUserPageWithSuspense = withSuspense(AdminUserPage)
const ArticlePageWithSuspense = withSuspense(ArticlePage)

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password', element: <ResetPasswordPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <CommunityPageWithSuspense /> },
          { path: '/article/:id', element: <ArticlePageWithSuspense /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: '/feed', element: <FeedPageWithSuspense /> },
              { path: '/subscriptions', element: <SubscriptionsPageWithSuspense /> },
              { path: '/bookmarks', element: <BookmarksPageWithSuspense /> },
            ],
          },
          {
            element: <AdminRoute />,
            children: [
              { path: '/admin', element: <AdminPageWithSuspense /> },
              { path: '/admin/users/:id', element: <AdminUserPageWithSuspense /> },
            ],
          },
        ],
      },
    ],
  },
])
