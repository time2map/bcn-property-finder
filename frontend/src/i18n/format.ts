import i18n from './index'

/** A number written the way the page language writes it (3,500 / 3.500). Reads the language on each call. */
export function formatNumber(n: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(i18n.language || 'en', options).format(n)
}

/** The same in English formats, for places that must not depend on the page language (file names, URLs). */
export const plainInteger = (n: number) => String(Math.round(n))

/**
 * An object whose texts are read from the language files each time they are asked for: the same constant works
 * in every language and follows a language switch (the component that reads it renders again).
 */
export function lazyLabels<K extends string>(prefix: string, keys: readonly K[]): Record<K, string> {
  const out = {} as Record<K, string>
  for (const k of keys) Object.defineProperty(out, k, { enumerable: true, get: () => i18n.t(`${prefix}.${k}` as never) })
  return out
}

/** "a, b and c" the way the page language joins a list. */
export function formatList(items: readonly string[]): string {
  return new Intl.ListFormat(i18n.language || 'en', { style: 'long', type: 'conjunction' }).format(items)
}
