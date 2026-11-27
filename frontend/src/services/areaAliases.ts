/**
 * Colloquial place names people type, mapped to the official areas (ids from public/data/areas.geojson).
 * An alias can cover several barris; ids missing from the dataset are ignored.
 */
export interface AreaAlias {
  name: string
  /** Extra spellings that should find the alias (matched like names). */
  also?: string[]
  areaIds: string[]
}

export const AREA_ALIASES: AreaAlias[] = [
  { name: 'El Born', also: ['Born'], areaIds: ['barri-0104'] },
  { name: 'Poblenou', also: ['Poble Nou'], areaIds: ['barri-1068', 'barri-1067', 'barri-1066', 'barri-1069', 'barri-1071'] },
  { name: 'Gothic Quarter', also: ['Gotic', 'Barrio Gotico'], areaIds: ['barri-0102'] },
  { name: 'Sagrada Familia', areaIds: ['barri-0206'] },
  { name: 'Left Eixample', also: ['Eixample Esquerra'], areaIds: ['barri-0208', 'barri-0209'] },
  { name: 'Right Eixample', also: ['Eixample Dreta'], areaIds: ['barri-0207'] },
  { name: 'Sant Gervasi', areaIds: ['barri-0524', 'barri-0525', 'barri-0526', 'barri-0527'] },
  { name: 'Diagonal Mar', areaIds: ['barri-1069'] },
  { name: 'Olympic Village', also: ['Vila Olimpica'], areaIds: ['barri-1067'] },
  { name: 'Hospitalet', areaIds: ['muni-lhospitalet-de-llobregat'] },
  { name: 'Sants', also: ['Sants Estacio'], areaIds: ['barri-0317', 'barri-0318'] },
  { name: 'Poble Sec', areaIds: ['barri-0311'] },
]
