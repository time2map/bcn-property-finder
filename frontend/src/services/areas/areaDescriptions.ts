// Short descriptions of the 73 barris of Barcelona for the area card (TODO-064). Written by hand, no third-party
// text. Only stable facts: where the barri is, what it is known for. To be read through by someone who knows the
// city before launch.
//
// The texts are in src/locales/<language>/areas.json, keyed by the barri code of the data ('01'…'73', the last two
// digits of `barri-0101`). They are not in the i18next namespaces: the English file alone is 9 KB gzipped, and only
// the area card needs them, so each file is loaded when a card first asks for it.

export type AreaTexts = Readonly<Record<string, string>>

export const DEFAULT_DESCRIPTION_LANG = 'en'

const files = import.meta.glob('../../locales/*/areas.json', { import: 'default' }) as
  Record<string, () => Promise<AreaTexts>>

const cache = new Map<string, Promise<AreaTexts>>()

/** The texts of a language; an empty set for a language that has no file. */
export function loadAreaTexts(lang: string): Promise<AreaTexts> {
  let texts = cache.get(lang)
  if (!texts) {
    const load = files[`../../locales/${lang}/areas.json`]
    texts = load ? load() : Promise.resolve({})
    cache.set(lang, texts)
  }
  return texts
}

/** The description of a barri in a language, falling back to English; null when there is none (a municipality). */
export async function areaDescription(code: string, lang: string = DEFAULT_DESCRIPTION_LANG): Promise<string | null> {
  const [own, fallback] = await Promise.all([loadAreaTexts(lang), loadAreaTexts(DEFAULT_DESCRIPTION_LANG)])
  return own[code] ?? fallback[code] ?? null
}
