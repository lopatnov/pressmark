import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useAuthStore } from '@/store/authStore'
import { useAdminStore } from '@/store/adminStore'
import { Sidebar } from './Sidebar'
import { LoginPage } from '@/pages/LoginPage'

// ── mock heavy dependencies ───────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock('@/components/layout/LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}))

vi.mock('@/api/clients', () => ({
  authClient: { logout: vi.fn().mockResolvedValue({}) },
  adminClient: { getSiteSettings: vi.fn().mockResolvedValue({}) },
  feedClient: {},
  subscriptionClient: {},
}))

// ── helpers ───────────────────────────────────────────────────────────────────

function renderSidebar() {
  return render(
    <MemoryRouter>
      <Sidebar isOpen={true} onClose={() => {}} />
    </MemoryRouter>,
  )
}

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  // Reset stores to unauthenticated state before each test
  useAuthStore.setState({
    accessToken: null,
    user: null,
    isInitialized: true,
    registrationMode: 'open',
    communityWindowDays: 1,
  })
  useAdminStore.setState({ settings: null })
})

// ── Sidebar ───────────────────────────────────────────────────────────────────

describe('Sidebar — invite_only hides Sign Up link', () => {
  it('shows Register link when registrationMode is open', () => {
    useAuthStore.setState({ registrationMode: 'open' })
    renderSidebar()
    expect(screen.getByText('nav.register')).toBeInTheDocument()
  })

  it('hides Register link when registrationMode is invite_only', () => {
    useAuthStore.setState({ registrationMode: 'invite_only' })
    renderSidebar()
    expect(screen.queryByText('nav.register')).not.toBeInTheDocument()
  })

  it('still shows Login link when invite_only', () => {
    useAuthStore.setState({ registrationMode: 'invite_only' })
    renderSidebar()
    expect(screen.getByText('nav.login')).toBeInTheDocument()
  })
})

// ── LoginPage ─────────────────────────────────────────────────────────────────

describe('LoginPage — invite_only hides Sign Up link', () => {
  it('shows Register link when registrationMode is open', () => {
    useAuthStore.setState({ registrationMode: 'open' })
    renderLoginPage()
    expect(screen.getByText('login.register')).toBeInTheDocument()
  })

  it('hides Register link when registrationMode is invite_only', () => {
    useAuthStore.setState({ registrationMode: 'invite_only' })
    renderLoginPage()
    expect(screen.queryByText('login.register')).not.toBeInTheDocument()
  })
})
