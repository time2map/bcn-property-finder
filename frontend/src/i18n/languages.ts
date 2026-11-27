// Which languages the app speaks and which one a visitor gets (TODO-065). Pure, no i18next: the list comes from ENV
// (VITE_ENABLED_LANGS, VITE_DEFAULT_LANG), so adding a language is a folder in src/locales plus a code in the list.

export type LangCode = string

const TAG = /^[a-z]{2,3}$/

/** Each language written in itself (the language list must be readable by someone who cannot read the page). */
const NATIVE_NAMES: Readonly<Record<string, string>> = { en: 'English', es: 'Español', ca: 'Català' }

export function parseEnabledLanguages(raw: string | undefined, fallback: LangCode): LangCode[] {
  const listed = (raw ?? '').split(',').map((c) => c.trim().toLowerCase()).filter((c) => TAG.test(c))
  return [...new Set([fallback, ...listed])]
}

export const DEFAULT_LANGUAGE: LangCode = (import.meta.env.VITE_DEFAULT_LANG as string | undefined)?.trim().toLowerCase() || 'en'
/** The languages that have files in src/locales. ENV can narrow or extend the list; without ENV (the dev server does not read .env.production) all of them are on. */
export const SHIPPED_LANGUAGES = 'en,es,ca'
export const ENABLED_LANGUAGES: readonly LangCode[] = parseEnabledLanguages(
  (import.meta.env.VITE_ENABLED_LANGS as string | undefined) || SHIPPED_LANGUAGES,
  DEFAULT_LANGUAGE,
)

export const LANG_STORAGE_KEY = 'bcn_lang'

export function languageName(code: LangCode): string {
  const known = NATIVE_NAMES[code]
  if (known) return known
  try {
    const name = new Intl.DisplayNames([code], { type: 'language' }).of(code)
    if (name) return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
  } catch { /* not a code Intl knows */ }
  return code
}

interface ResolveInput {
  enabled: readonly LangCode[]
  fallback: LangCode
  search: string
  stored: string | null
  browser: readonly string[]
}

/** `?lang=` (a shared link) → the saved choice → the browser's languages → the default. */
export function resolveLanguage({ enabled, fallback, search, stored, browser }: ResolveInput): LangCode {
  const ok = (c: string | null | undefined): c is string => !!c && enabled.includes(c)
  const fromUrl = new URLSearchParams(search).get('lang')?.toLowerCase()
  if (ok(fromUrl)) return fromUrl
  if (ok(stored)) return stored
  for (const tag of browser) {
    const code = tag.toLowerCase().split('-')[0]
    if (ok(code)) return code
  }
  return fallback
}
