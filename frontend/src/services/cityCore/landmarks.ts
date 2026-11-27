import i18n from '../../i18n'

export interface Landmark {
  id: string
  name: string
  lng: number
  lat: number
}

/** IDs of landmarks whose shapes are drawn from landmark-geometries.json. */
export const SHAPE_LANDMARK_IDS = new Set(['montjuic', 'eixample', 'waterfront'])

export const LANDMARKS: Landmark[] = [
  { id: 'sagrada', get name() { return i18n.t('conditions:landmarks.sagrada') }, lng: 2.1744, lat: 41.4036 },
  { id: 'placa_cat', get name() { return i18n.t('conditions:landmarks.placa_cat') }, lng: 2.1700, lat: 41.3870 },
  { id: 'barceloneta', get name() { return i18n.t('conditions:landmarks.barceloneta') }, lng: 2.1910, lat: 41.3799 },
  { id: 'barri_gotic', get name() { return i18n.t('conditions:landmarks.barri_gotic') }, lng: 2.1762, lat: 41.3840 },
  { id: 'pg_gracia', get name() { return i18n.t('conditions:landmarks.pg_gracia') }, lng: 2.1649, lat: 41.3917 },
  { id: 'arc_triomf', get name() { return i18n.t('conditions:landmarks.arc_triomf') }, lng: 2.1805, lat: 41.3909 },
  { id: 'montjuic', get name() { return i18n.t('conditions:landmarks.montjuic') }, lng: 2.1510, lat: 41.3630 },
  { id: 'placa_espanya', get name() { return i18n.t('conditions:landmarks.placa_espanya') }, lng: 2.1489, lat: 41.3754 },
  { id: 'glories', get name() { return i18n.t('conditions:landmarks.glories') }, lng: 2.1899, lat: 41.4034 },
  { id: 'poblenou', get name() { return i18n.t('conditions:landmarks.poblenou') }, lng: 2.2011, lat: 41.3975 },
  { id: 'parc_guell', get name() { return i18n.t('conditions:landmarks.parc_guell') }, lng: 2.1527, lat: 41.4145 },
  { id: 'eixample', get name() { return i18n.t('conditions:landmarks.eixample') }, lng: 2.1685, lat: 41.3870 },
  { id: 'waterfront', get name() { return i18n.t('conditions:landmarks.waterfront') }, lng: 2.2043, lat: 41.3991 },
]

export const ALL_LANDMARK_IDS = LANDMARKS.map((l) => l.id)
