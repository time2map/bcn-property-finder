export interface Landmark {
  id: string
  name: string
  lng: number
  lat: number
}

/** IDs of landmarks whose shapes are drawn from landmark-geometries.json. */
export const SHAPE_LANDMARK_IDS = new Set(['montjuic', 'eixample', 'waterfront'])

export const LANDMARKS: Landmark[] = [
  { id: 'sagrada',       name: 'Sagrada Família',    lng: 2.1744, lat: 41.4036 },
  { id: 'placa_cat',     name: 'Plaça de Catalunya', lng: 2.1700, lat: 41.3870 },
  { id: 'barceloneta',   name: 'Barceloneta',         lng: 2.1910, lat: 41.3799 },
  { id: 'barri_gotic',   name: 'Barri Gòtic',         lng: 2.1762, lat: 41.3840 },
  { id: 'pg_gracia',     name: 'Passeig de Gràcia',  lng: 2.1649, lat: 41.3917 },
  { id: 'arc_triomf',    name: 'Arc de Triomf',       lng: 2.1805, lat: 41.3909 },
  { id: 'montjuic',      name: 'Montjuïc',            lng: 2.1510, lat: 41.3630 },
  { id: 'placa_espanya', name: "Plaça d'Espanya",     lng: 2.1489, lat: 41.3754 },
  { id: 'glories',       name: 'Torre Glòries',       lng: 2.1899, lat: 41.4034 },
  { id: 'poblenou',      name: 'Rambla del Poblenou', lng: 2.2011, lat: 41.3975 },
  { id: 'parc_guell',    name: 'Parc Güell',          lng: 2.1527, lat: 41.4145 },
  { id: 'eixample',      name: 'Eixample',            lng: 2.1685, lat: 41.3870 },
  { id: 'waterfront',    name: 'Waterfront',          lng: 2.2043, lat: 41.3991 },
]

export const ALL_LANDMARK_IDS = LANDMARKS.map((l) => l.id)
