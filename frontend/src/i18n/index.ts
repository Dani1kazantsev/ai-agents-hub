import { createI18n } from 'vue-i18n'
import en from './en'
import ru from './ru'

const savedLocale = localStorage.getItem('locale') || 'en'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { en, ru },
})

export default i18n

export function setLocale(locale: 'en' | 'ru') {
  i18n.global.locale.value = locale
  localStorage.setItem('locale', locale)
  document.documentElement.lang = locale
}
