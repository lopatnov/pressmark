import { useCallback, useEffect, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { Menu, Flag } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'
import { adminClient } from '@/api/clients'
import { useAuthStore } from '@/store/authStore'

export function AppLayout() {
  const { t } = useTranslation('common')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])
  const isAdmin = useAuthStore((s) => s.isAdmin())
  const navigate = useNavigate()
  const [pendingReports, setPendingReports] = useState(0)

  useEffect(() => {
    if (!isAdmin) return
    adminClient
      .getPendingReportCount({})
      .then((res) => setPendingReports(res.count))
      .catch(() => {})
  }, [isAdmin])

  return (
    <div className="flex h-screen overflow-hidden">
      {sidebarOpen && (
        <div
          role="presentation"
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={closeSidebar}
        />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      <main className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-20 flex h-12 items-center justify-between border-b border-border bg-background px-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label={t('nav.openMenu')}
            className="cursor-pointer rounded p-1.5 hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              aria-label="Reports"
              className="relative cursor-pointer rounded p-1.5 hover:bg-muted"
            >
              <Flag className="h-5 w-5 text-muted-foreground" />
              {pendingReports > 0 && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-orange-500" />
              )}
            </button>
          )}
        </div>
        <Outlet />
      </main>
    </div>
  )
}
