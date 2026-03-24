import { useTranslation } from 'react-i18next'

export function RegisterPage() {
  const { t } = useTranslation('auth')
  return <div className="p-4"><h1 className="text-2xl font-semibold">{t('register.title')}</h1></div>
}
