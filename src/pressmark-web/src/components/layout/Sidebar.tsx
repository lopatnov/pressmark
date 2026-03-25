import { NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Globe, Rss, Bookmark, Settings, LogOut, LogIn, UserPlus, BookOpen } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useFeedStore } from '@/store/feedStore'
import { authClient } from '@/api/clients'

export function Sidebar() {
  const { t } = useTranslation('common')
  const navigate = useNavigate()
  const user            = useAuthStore((s) => s.user)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated())
  const isAdmin         = useAuthStore((s) => s.isAdmin())
  const clearAuth       = useAuthStore((s) => s.clearAuth)
  const totalUnread     = useFeedStore((s) => s.totalUnread)

  const handleLogout = async () => {
    await authClient.logout({}).catch(() => {})
    clearAuth()
    navigate('/')
  }

  const cls = ({ isActive }: { isActive: boolean }) =>
    'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors ' +
    (isActive
      ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
      : 'text-sidebar-foreground hover:bg-sidebar-accent/60')

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-sidebar-border bg-sidebar">
      <div className="flex flex-col border-b border-sidebar-border px-4 py-3">
        <span className="text-sm font-semibold text-sidebar-foreground">{t('appName')}</span>
        {user && (
          <span className="truncate text-xs text-muted-foreground" title={user.email}>
            {user.email}
          </span>
        )}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        <NavLink to="/" end className={cls}>
          <Globe className="h-4 w-4 shrink-0" />
          {t('nav.community')}
        </NavLink>
        {isAuthenticated && (
          <>
            <NavLink to="/feed" className={cls}>
              <Rss className="h-4 w-4 shrink-0" />
              <span className="flex-1">{t('nav.feed')}</span>
              {totalUnread > 0 && (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-medium text-primary-foreground">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </NavLink>
            <NavLink to="/subscriptions" className={cls}>
              <BookOpen className="h-4 w-4 shrink-0" />
              {t('nav.subscriptions')}
            </NavLink>
            <NavLink to="/bookmarks" className={cls}>
              <Bookmark className="h-4 w-4 shrink-0" />
              {t('nav.bookmarks')}
            </NavLink>
          </>
        )}
        <div className="my-1.5 border-t border-sidebar-border" />
        {isAdmin && (
          <NavLink to="/admin" className={cls}>
            <Settings className="h-4 w-4 shrink-0" />
            {t('nav.admin')}
          </NavLink>
        )}
        {isAuthenticated ? (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm text-sidebar-foreground transition-colors hover:bg-sidebar-accent/60"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {t('nav.logout')}
          </button>
        ) : (
          <>
            <NavLink to="/login" className={cls}>
              <LogIn className="h-4 w-4 shrink-0" />
              {t('nav.login')}
            </NavLink>
            <NavLink to="/register" className={cls}>
              <UserPlus className="h-4 w-4 shrink-0" />
              {t('nav.register')}
            </NavLink>
          </>
        )}
      </nav>
    </aside>
  )
}
