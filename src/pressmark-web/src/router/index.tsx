import { createBrowserRouter } from 'react-router-dom'
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
  { path: '/', element: <CommunityPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
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
])
