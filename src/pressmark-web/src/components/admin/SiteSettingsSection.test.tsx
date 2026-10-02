import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import SiteSettingsSection from './SiteSettingsSection'
import { adminClient } from '@/api/clients'
import { useAdminStore, type AdminSiteSettings } from '@/store/adminStore'

// react-i18next and sonner are mocked globally in src/test-setup.ts

vi.mock('@/api/clients', () => ({
  adminClient: {
    updateSiteSettings: vi.fn(),
    clearOldFeeds: vi.fn(),
  },
}))

const loaded: AdminSiteSettings = {
  siteName: 'Pressmark',
  siteDescription: '',
  communityWindowDays: 7,
  registrationMode: 'open',
  smtpHost: 'smtp.example.com',
  smtpPort: 587,
  smtpUser: 'mailer',
  smtpUseTls: true,
  smtpFromAddress: 'noreply@example.com',
  commentsEnabled: true,
  feedRetentionDays: 90,
  communityPageEnabled: true,
}

beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(adminClient.updateSiteSettings).mockResolvedValue({} as never)
  useAdminStore.setState({ settings: loaded })
})

describe('SiteSettingsSection', () => {
  it('sends a new SMTP password to the server but never keeps it in the store', async () => {
    const user = userEvent.setup()
    render(<SiteSettingsSection />)

    await user.type(screen.getByLabelText('admin:settings.smtpPassword'), 's3cret')
    await user.click(screen.getByRole('button', { name: 'common:save' }))

    await waitFor(() => expect(adminClient.updateSiteSettings).toHaveBeenCalledTimes(1))
    expect(adminClient.updateSiteSettings).toHaveBeenCalledWith({
      settings: { ...loaded, smtpPassword: 's3cret' },
    })
    expect(useAdminStore.getState().settings).toEqual(loaded)
    expect(useAdminStore.getState().settings).not.toHaveProperty('smtpPassword')
  })

  it('submits edited fields, numbers and checkboxes included', async () => {
    const user = userEvent.setup()
    render(<SiteSettingsSection />)

    const siteName = screen.getByLabelText('admin:settings.siteName')
    await user.clear(siteName)
    await user.type(siteName, 'My Reader')
    const retention = screen.getByLabelText('admin:settings.feedRetentionDays')
    await user.clear(retention)
    await user.type(retention, '30')
    await user.click(screen.getByLabelText('admin:settings.commentsEnabled'))
    await user.click(screen.getByRole('button', { name: 'common:save' }))

    await waitFor(() => expect(adminClient.updateSiteSettings).toHaveBeenCalledTimes(1))
    expect(adminClient.updateSiteSettings).toHaveBeenCalledWith({
      settings: {
        ...loaded,
        siteName: 'My Reader',
        feedRetentionDays: 30,
        commentsEnabled: false,
        smtpPassword: '',
      },
    })
  })

  it('reports a validation error against its field instead of saving', async () => {
    const user = userEvent.setup()
    render(<SiteSettingsSection />)

    const siteName = screen.getByLabelText('admin:settings.siteName')
    await user.clear(siteName)
    await user.click(screen.getByRole('button', { name: 'common:save' }))

    await waitFor(() => expect(siteName).toHaveAttribute('aria-invalid', 'true'))
    expect(siteName).toHaveAccessibleDescription('admin:settings.errors.required')
    expect(adminClient.updateSiteSettings).not.toHaveBeenCalled()
  })
})
