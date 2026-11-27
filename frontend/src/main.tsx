import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme, type MantineColorsTuple } from '@mantine/core'
import '@mantine/core/styles.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-sans/600.css'
import '@fontsource/ibm-plex-sans/700.css'
import App from './App.tsx'
import './index.css'
import { loadMapStyle } from './services/mapStyle'
import { afterFirstPaint } from './services/firstPaint'
import { loadAreaJoin } from './services/areas/areaJoinLoader'
import { loadScores } from './services/buildings/buildingData'
import { features } from './features'
import { initI18n } from './i18n'

// The base map style is asked for before React renders: it is ready when the map code is (TODO-058).
void loadMapStyle()
// What colours the first view is asked for right after the first paint, not when the map code (MapLibre, 270 KB)
// has arrived: the scores, and for the area view areas.geojson with area-start.json.
void loadScores().catch(() => { /* the map layers report it */ })
if (features.areas) void afterFirstPaint().then(loadAreaJoin).catch(() => { /* the map layers report it */ })

const FONT_FAMILY = "'IBM Plex Sans', system-ui, sans-serif"

// time2map coral (#F06965 at shade 6) — used for checkboxes, switches and other primary controls.
const brand: MantineColorsTuple = [
  '#fff0ef', '#ffe1df', '#f9c3c0', '#f2a4a0', '#ec8984',
  '#e8746f', '#f06965', '#dd524d', '#c5443f', '#a8352f',
]

const theme = createTheme({
  fontFamily: FONT_FAMILY,
  headings: { fontFamily: FONT_FAMILY },
  primaryColor: 'brand',
  colors: { brand },
})

// The language is ready before the first render (English is in the bundle; another language is one small file).
void initI18n().then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <MantineProvider theme={theme}>
        <App />
      </MantineProvider>
    </StrictMode>,
  )
})
