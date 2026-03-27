import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'

import enCommon from './locales/en/common.json'
import enAuth from './locales/en/auth.json'
import enFeed from './locales/en/feed.json'
import enSubscriptions from './locales/en/subscriptions.json'
import enAdmin from './locales/en/admin.json'

import ukCommon from './locales/uk/common.json'
import ukAuth from './locales/uk/auth.json'
import ukFeed from './locales/uk/feed.json'
import ukSubscriptions from './locales/uk/subscriptions.json'
import ukAdmin from './locales/uk/admin.json'

import ruCommon from './locales/ru/common.json'
import ruAuth from './locales/ru/auth.json'
import ruFeed from './locales/ru/feed.json'
import ruSubscriptions from './locales/ru/subscriptions.json'
import ruAdmin from './locales/ru/admin.json'

import esCommon from './locales/es/common.json'
import esAuth from './locales/es/auth.json'
import esFeed from './locales/es/feed.json'
import esSubscriptions from './locales/es/subscriptions.json'
import esAdmin from './locales/es/admin.json'

import frCommon from './locales/fr/common.json'
import frAuth from './locales/fr/auth.json'
import frFeed from './locales/fr/feed.json'
import frSubscriptions from './locales/fr/subscriptions.json'
import frAdmin from './locales/fr/admin.json'

import deCommon from './locales/de/common.json'
import deAuth from './locales/de/auth.json'
import deFeed from './locales/de/feed.json'
import deSubscriptions from './locales/de/subscriptions.json'
import deAdmin from './locales/de/admin.json'

import koCommon from './locales/ko/common.json'
import koAuth from './locales/ko/auth.json'
import koFeed from './locales/ko/feed.json'
import koSubscriptions from './locales/ko/subscriptions.json'
import koAdmin from './locales/ko/admin.json'

import zhCommon from './locales/zh/common.json'
import zhAuth from './locales/zh/auth.json'
import zhFeed from './locales/zh/feed.json'
import zhSubscriptions from './locales/zh/subscriptions.json'
import zhAdmin from './locales/zh/admin.json'

import jaCommon from './locales/ja/common.json'
import jaAuth from './locales/ja/auth.json'
import jaFeed from './locales/ja/feed.json'
import jaSubscriptions from './locales/ja/subscriptions.json'
import jaAdmin from './locales/ja/admin.json'

import ptCommon from './locales/pt/common.json'
import ptAuth from './locales/pt/auth.json'
import ptFeed from './locales/pt/feed.json'
import ptSubscriptions from './locales/pt/subscriptions.json'
import ptAdmin from './locales/pt/admin.json'

import itCommon from './locales/it/common.json'
import itAuth from './locales/it/auth.json'
import itFeed from './locales/it/feed.json'
import itSubscriptions from './locales/it/subscriptions.json'
import itAdmin from './locales/it/admin.json'

import plCommon from './locales/pl/common.json'
import plAuth from './locales/pl/auth.json'
import plFeed from './locales/pl/feed.json'
import plSubscriptions from './locales/pl/subscriptions.json'
import plAdmin from './locales/pl/admin.json'

import nlCommon from './locales/nl/common.json'
import nlAuth from './locales/nl/auth.json'
import nlFeed from './locales/nl/feed.json'
import nlSubscriptions from './locales/nl/subscriptions.json'
import nlAdmin from './locales/nl/admin.json'

import csCommon from './locales/cs/common.json'
import csAuth from './locales/cs/auth.json'
import csFeed from './locales/cs/feed.json'
import csSubscriptions from './locales/cs/subscriptions.json'
import csAdmin from './locales/cs/admin.json'

import svCommon from './locales/sv/common.json'
import svAuth from './locales/sv/auth.json'
import svFeed from './locales/sv/feed.json'
import svSubscriptions from './locales/sv/subscriptions.json'
import svAdmin from './locales/sv/admin.json'

import roCommon from './locales/ro/common.json'
import roAuth from './locales/ro/auth.json'
import roFeed from './locales/ro/feed.json'
import roSubscriptions from './locales/ro/subscriptions.json'
import roAdmin from './locales/ro/admin.json'

import huCommon from './locales/hu/common.json'
import huAuth from './locales/hu/auth.json'
import huFeed from './locales/hu/feed.json'
import huSubscriptions from './locales/hu/subscriptions.json'
import huAdmin from './locales/hu/admin.json'

import trCommon from './locales/tr/common.json'
import trAuth from './locales/tr/auth.json'
import trFeed from './locales/tr/feed.json'
import trSubscriptions from './locales/tr/subscriptions.json'
import trAdmin from './locales/tr/admin.json'

const savedLocale = localStorage.getItem('i18n-locale') ?? 'en'

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: enCommon, auth: enAuth, feed: enFeed, subscriptions: enSubscriptions, admin: enAdmin },
      uk: { common: ukCommon, auth: ukAuth, feed: ukFeed, subscriptions: ukSubscriptions, admin: ukAdmin },
      ru: { common: ruCommon, auth: ruAuth, feed: ruFeed, subscriptions: ruSubscriptions, admin: ruAdmin },
      es: { common: esCommon, auth: esAuth, feed: esFeed, subscriptions: esSubscriptions, admin: esAdmin },
      fr: { common: frCommon, auth: frAuth, feed: frFeed, subscriptions: frSubscriptions, admin: frAdmin },
      de: { common: deCommon, auth: deAuth, feed: deFeed, subscriptions: deSubscriptions, admin: deAdmin },
      ko: { common: koCommon, auth: koAuth, feed: koFeed, subscriptions: koSubscriptions, admin: koAdmin },
      zh: { common: zhCommon, auth: zhAuth, feed: zhFeed, subscriptions: zhSubscriptions, admin: zhAdmin },
      ja: { common: jaCommon, auth: jaAuth, feed: jaFeed, subscriptions: jaSubscriptions, admin: jaAdmin },
      pt: { common: ptCommon, auth: ptAuth, feed: ptFeed, subscriptions: ptSubscriptions, admin: ptAdmin },
      it: { common: itCommon, auth: itAuth, feed: itFeed, subscriptions: itSubscriptions, admin: itAdmin },
      pl: { common: plCommon, auth: plAuth, feed: plFeed, subscriptions: plSubscriptions, admin: plAdmin },
      nl: { common: nlCommon, auth: nlAuth, feed: nlFeed, subscriptions: nlSubscriptions, admin: nlAdmin },
      cs: { common: csCommon, auth: csAuth, feed: csFeed, subscriptions: csSubscriptions, admin: csAdmin },
      sv: { common: svCommon, auth: svAuth, feed: svFeed, subscriptions: svSubscriptions, admin: svAdmin },
      ro: { common: roCommon, auth: roAuth, feed: roFeed, subscriptions: roSubscriptions, admin: roAdmin },
      hu: { common: huCommon, auth: huAuth, feed: huFeed, subscriptions: huSubscriptions, admin: huAdmin },
      tr: { common: trCommon, auth: trAuth, feed: trFeed, subscriptions: trSubscriptions, admin: trAdmin },
    },
    lng: savedLocale,
    fallbackLng: 'en',
    ns: ['common', 'auth', 'feed', 'subscriptions', 'admin'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
  })

export default i18n
