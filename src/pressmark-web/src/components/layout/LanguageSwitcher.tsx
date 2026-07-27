import { useTranslation } from 'react-i18next'
import { Languages } from 'lucide-react'
import { I18N_LOCALE_STORAGE_KEY } from '@/i18n'

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
  { code: 'ru', label: 'Русский' },
  { code: 'de', label: 'Deutsch' },
  { code: 'fr', label: 'Français' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
  { code: 'pl', label: 'Polski' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'cs', label: 'Čeština' },
  { code: 'sv', label: 'Svenska' },
  { code: 'ro', label: 'Română' },
  { code: 'hu', label: 'Magyar' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ko', label: '한국어' },
  { code: 'zh', label: '中文' },
  { code: 'ja', label: '日本語' },
] as const

export function LanguageSwitcher() {
  const { t, i18n } = useTranslation('common')

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const locale = e.target.value
    i18n.changeLanguage(locale)
    localStorage.setItem(I18N_LOCALE_STORAGE_KEY, locale)
  }

  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <Languages className="h-4 w-4 shrink-0 text-muted-foreground" />
      <select
        value={i18n.language}
        onChange={handleChange}
        className="flex-1 cursor-pointer bg-transparent text-sm text-sidebar-foreground outline-none"
        title={t('language')}
        aria-label={t('language')}
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>
            {label}
          </option>
        ))}
      </select>
    </div>
  )
}
