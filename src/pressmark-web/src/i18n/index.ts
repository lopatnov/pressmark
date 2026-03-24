import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enFeed from './locales/en/feed.json'
import enSubscriptions from './locales/en/subscriptions.json'
import enAdmin from './locales/en/admin.json'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        common: enCommon,
        auth: enAuth,
        feed: enFeed,
        subscriptions: enSubscriptions,
        admin: enAdmin,
      },
    },
    lng: 'en',
    fallbackLng: 'en',
    ns: ['common', 'auth', 'feed', 'subscriptions', 'admin'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
