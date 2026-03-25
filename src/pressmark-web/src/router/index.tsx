import { createBrowserRouter } from 'react-router-dom'
import { RootLayout } from '@/components/layout/RootLayout'
import { AppLayout } from '@/components/layout/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { AdminRoute } from './AdminRoute'
import { CommunityPage } from '@/pages/CommunityPage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { FeedPage } from '@/pages/FeedPage'
import { SubscriptionsPage } from '@/pages/SubscriptionsPage'
import { BookmarksPage } from '@/pages/BookmarksPage'
import { AdminPage } from '@/pages/AdminPage'

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      {
        element: <AppLayout />,
        children: [
          { path: '/', element: <CommunityPage /> },
          {
            element: <ProtectedRoute />,
            children: [
              { path: '/feed', element: <FeedPage /> },
              { path: '/subscriptions', element: <SubscriptionsPage /> },
              { path: '/bookmarks', element: <BookmarksPage /> },
            ],
          },
          {
            element: <AdminRoute />,
            children: [{ path: '/admin', element: <AdminPage /> }],
          },
        ],
      },
    ],
  },
])
