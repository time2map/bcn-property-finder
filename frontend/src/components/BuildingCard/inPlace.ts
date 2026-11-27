/**
 * "in el Raval" / "al Raval": the place after the preposition of the page language. Catalan "a" joins the articles
 * el and els; Spanish "en" joins nothing, so one rule per language covers every barri and municipality name.
 */
export function inPlace(t: (key: string, options: { name: string }) => string, name: string): string {
  const art = /^(els?) (.+)$/.exec(name)
  return art ? t(`rank.in${art[1] === 'el' ? 'El' : 'Els'}`, { name: art[2] }) : t('rank.in', { name })
}
