import { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Sidebar } from './Sidebar'

export function AppLayout() {
  const { t } = useTranslation('common')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

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
        <div className="sticky top-0 z-20 flex h-12 items-center border-b border-border bg-background px-3 md:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label={t('nav.openMenu')}
            className="cursor-pointer rounded p-1.5 hover:bg-muted"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  )
}
