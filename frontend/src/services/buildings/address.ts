// Catastro addresses come as 'CL ARAGO 255; RB CATALUNYA 30' — street-type code, upper case, no accents.

const STREET_TYPES: Record<string, string> = {
  AV: 'Avinguda', BJ: 'Baixada', CL: 'Carrer', CM: 'Camí', CR: 'Carretera', DS: 'Disseminat', GV: 'Gran Via',
  PG: 'Polígon', PJ: 'Passatge', PS: 'Passeig', PZ: 'Plaça', RB: 'Rambla', RD: 'Ronda', TR: 'Travessera',
  TV: 'Travessia', UR: 'Urbanització', VI: 'Via',
}
const LOWER = new Set(['DE', 'DEL', 'DELS', 'LA', 'LES', 'EL', 'ELS', 'LOS', 'I', 'Y', 'D', 'L'])

function titleCase(word: string, first: boolean): string {
  if (!first && LOWER.has(word)) return word.toLowerCase()
  return word.charAt(0) + word.slice(1).toLowerCase()
}

/** 'CL DIPUTACIO 279' → 'Carrer Diputacio 279'; 'S-N' (no number) → 's/n'. */
function prettyOne(part: string): string {
  const words = part.trim().split(/\s+/)
  const type = STREET_TYPES[words[0]]
  const rest = type ? words.slice(1) : words
  const name = rest.map((w, k) => (w === 'S-N' ? 's/n' : /^\d/.test(w) ? w : titleCase(w, !type && k === 0)))
  return [type, ...name].filter(Boolean).join(' ')
}

/** Every address of the building, one by one ('CL ARAGO 255; RB CATALUNYA 30' → two). */
export function prettyAddresses(raw: string | undefined): string[] {
  return raw ? raw.split('; ').filter((p) => p.trim() !== '').map(prettyOne) : []
}

/** All the addresses on one line, joined with ' · '; null without an address. */
export function prettyAddress(raw: string | undefined): string | null {
  const all = prettyAddresses(raw)
  return all.length > 0 ? all.join(' · ') : null
}

/** Catastro's own page for the building (cadastral reference: 7 + 7 characters). */
export function catastroUrl(ref: string): string {
  return `https://www1.sedecatastro.gob.es/CYCBienInmueble/OVCListaBienes.aspx?rc1=${ref.slice(0, 7)}&rc2=${ref.slice(7, 14)}`
}

/** Catastro's facade photo of the building. */
export function facadePhotoUrl(ref: string): string {
  return `https://ovc.catastro.meh.es/OVCServWeb/OVCWcfLibres/OVCFotoFachada.svc/RecuperarFotoFachadaGet?ReferenciaCatastral=${ref}`
}
