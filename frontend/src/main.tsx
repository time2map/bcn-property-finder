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
import { registerPmtilesProtocol } from './services/noise/pmtilesProtocol'

registerPmtilesProtocol()

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

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme}>
      <App />
    </MantineProvider>
  </StrictMode>,
)
