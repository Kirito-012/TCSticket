/**
 * Languages the app can be shown in. English is the source: every screen asks for its text by the
 * English wording (`t('Mark as done')`), and a language file only needs the sentences it has a
 * translation for. Anything missing simply shows in English, so a language can be added or fixed
 * one screen at a time.
 */

export const LANGUAGES = [
  { code: 'en', native: 'English', english: 'English' },
  { code: 'hi', native: 'हिन्दी', english: 'Hindi' },
  { code: 'bn', native: 'বাংলা', english: 'Bengali' },
  { code: 'mr', native: 'मराठी', english: 'Marathi' },
  { code: 'gu', native: 'ગુજરાતી', english: 'Gujarati' },
  { code: 'pa', native: 'ਪੰਜਾਬੀ', english: 'Punjabi' },
  { code: 'ta', native: 'தமிழ்', english: 'Tamil' },
  { code: 'te', native: 'తెలుగు', english: 'Telugu' },
  { code: 'kn', native: 'ಕನ್ನಡ', english: 'Kannada' },
  { code: 'ml', native: 'മലയാളം', english: 'Malayalam' },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]['code']

export const DEFAULT_LANGUAGE: LanguageCode = 'en'

/** The cookie that remembers the chosen language. */
export const LANGUAGE_COOKIE = 'lang'

export function isLanguageCode(value: unknown): value is LanguageCode {
  return LANGUAGES.some((l) => l.code === value)
}

export type Messages = Record<string, string>
export type Params = Record<string, string | number>
export type Translate = (text: string, params?: Params) => string

/** Fills in {placeholders}: interpolate('{done} of {total}', { done: 2, total: 5 }) -> '2 of 5'. */
export function interpolate(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in params ? String(params[key]) : whole,
  )
}

/** Builds the translate function for one language's messages (English = no messages). */
export function makeTranslate(messages: Messages): Translate {
  return (text, params) => interpolate(messages[text] ?? text, params)
}

/** The locale tag used for dates and numbers in each language (Indian formats). */
export function localeTag(code: LanguageCode): string {
  return code === 'en' ? 'en-IN' : `${code}-IN`
}
