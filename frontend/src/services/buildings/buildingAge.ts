/**
 * Building age in the Livability Index (TODO-047): the user ticks the eras they like; a building of a liked era
 * scores 100, any other 0, fading over AGE_ERA_BLUR_YEARS at the edges of a liked era. The era names and the line
 * on what an era means for living there are written for the default bounds.
 */
import i18n from '../../i18n'

const BOUNDS = String(import.meta.env.VITE_AGE_ERA_BOUNDS ?? '1900,1940,1980,2007').split(',').map(Number)
export const AGE_ERA_BLUR_YEARS = Number(import.meta.env.VITE_AGE_ERA_BLUR_YEARS ?? 5)
/** Catastro's date for many old buildings whose exact year is unknown (9,695 buildings say 1900). */
export const UNCERTAIN_YEAR = Number(import.meta.env.VITE_AGE_UNCERTAIN_YEAR ?? 1900)

// The texts of the five default eras are in the language files (conditions: era.e0 … e4).
const DEFAULT_ERA_COUNT = 5

export interface AgeEra {
  id: string
  name: string
  /** "before 1900", "1900–1939", "2007 on". */
  years: string
  about: string
  /** First year of the era; the era ends before `end`. */
  start: number
  end: number
}

export const AGE_ERAS: AgeEra[] = [-Infinity, ...BOUNDS].map((start, i) => {
  const end = BOUNDS[i] ?? Infinity
  const id = start === -Infinity ? `before-${end}` : end === Infinity ? `${start}-on` : `${start}-${end - 1}`
  const known = BOUNDS.length === DEFAULT_ERA_COUNT - 1
  // Texts are read when asked for, so they follow the page language.
  return {
    id, start, end,
    get years() {
      if (start === -Infinity) return i18n.t('conditions:era.before', { year: end })
      if (end === Infinity) return i18n.t('conditions:era.on', { year: start })
      return i18n.t('conditions:era.range', { from: start, to: end - 1 })
    },
    get name() { return known ? i18n.t(`conditions:era.e${i}.name` as never) as string : this.years },
    get about() { return known ? i18n.t(`conditions:era.e${i}.about` as never) as string : '' },
  }
})

export const ALL_AGE_ERA_IDS = AGE_ERAS.map((e) => e.id)

export function eraOf(year: number): AgeEra {
  return AGE_ERAS.find((e) => year >= e.start && year < e.end)!
}

/** 1 inside the era, fading to 0 over `blur` years outside it. */
function membership(year: number, era: AgeEra, blur: number): number {
  const d = year < era.start ? era.start - year : year >= era.end ? year - era.end + 1 : 0
  if (d === 0) return 1
  return blur > 0 ? Math.max(0, 1 - d / blur) : 0
}

/** Age score 0–100 of a building built in `year` for the liked eras; null when the year is unknown. */
export function ageScore(year: number | null, liked: readonly string[], blur = AGE_ERA_BLUR_YEARS): number | null {
  if (year === null) return null
  const years = year === UNCERTAIN_YEAR ? [year - 1, year] : [year]
  let best = 0
  for (const era of AGE_ERAS) {
    if (!liked.includes(era.id)) continue
    for (const y of years) best = Math.max(best, membership(y, era, blur))
  }
  return Math.round(best * 100)
}
