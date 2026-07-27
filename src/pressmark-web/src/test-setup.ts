import { vi } from 'vitest'
import '@testing-library/jest-dom'

// Shared across component/hook tests — `t` must be a stable reference or it
// lands in useCallback deps and causes infinite re-renders in components that
// include it as a dep. Individual test files can still override this with
// their own vi.mock('react-i18next', ...) if they need different behavior.
vi.mock('react-i18next', () => {
  const t = (key: string) => key
  return { useTranslation: () => ({ t }) }
})

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))
