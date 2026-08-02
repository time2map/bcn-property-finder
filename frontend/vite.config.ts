import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The screenshot/vision feature ships the Anthropic SDK, which can't be bundled for the browser
// (v0.98+ transitively imports node:fs/crypto) and would embed the client API key. Unless the
// feature is explicitly enabled, resolve '@anthropic-ai/sdk' to an inert virtual stub so the SDK
// and the key stay out of the bundle. parseScreenshot() short-circuits before constructing the
// client when the flag is off, so the stub is never actually invoked.
function stubAnthropicSdk(): Plugin {
  const STUB_ID = '\0anthropic-sdk-stub'
  return {
    name: 'stub-anthropic-sdk',
    enforce: 'pre',
    resolveId(id) {
      return id === '@anthropic-ai/sdk' ? STUB_ID : null
    },
    load(id) {
      if (id !== STUB_ID) return null
      return 'export default class { constructor() { throw new Error("Anthropic SDK is stubbed out: the screenshot feature is disabled in this build.") } }'
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  // Never stub under test — vitest runs in Node (Node builtins resolve) and needs the real
  // specifier for vi.doMock to intercept.
  const stub = mode !== 'test' && env.VITE_FEATURE_SCREENSHOT !== 'true'

  return {
    plugins: [react(), ...(stub ? [stubAnthropicSdk()] : [])],
    base: '/',
    test: {
      environment: 'jsdom',
      globals: true,
      setupFiles: ['./src/test/setup.ts'],
      css: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: [
          'src/main.tsx',
          'src/vite-env.d.ts',
          'src/test/**',
          'src/types/**',
          'src/services/walkability/walkabilityTypes.ts',
          // MapLibre / browser-integration glue — validated via Playwright & manual QA, not
          // meaningfully unit-testable in jsdom (map.addSource/addLayer, canvas, pmtiles binary).
          'src/components/PropertyPins/PinLayer.tsx',
          'src/components/PropertyPins/PinAccuracyLayer.tsx',
          'src/components/Map/Map.tsx',
          'src/components/Map/MapContextMenu.tsx',
          'src/components/NoiseLayer/NoiseLayer.tsx',
          'src/components/LandmarksLayer/LandmarksLayer.tsx',
          'src/components/IdealistaPricesLayer/IdealistaPricesLayer.tsx',
          'src/components/IdealistaPricesLayer/PriceWindowSlider.tsx',
          'src/components/PropertyPins/PhotoLightbox.tsx',
          'src/components/IsochroneLayer/isochroneUtils.ts',
          'src/services/imageUtils.ts',
          'src/services/noise/noiseData.ts',
          'src/services/noise/pmtilesProtocol.ts',
          'src/services/walkability/pmtilesPoi.ts',
          'src/services/idealista/idealistaRawData.ts',
        ],
        // Branch coverage runs lower than line coverage (map/browser conditionals); keep the
        // stricter 80% on lines/functions/statements, allow a realistic 70% on branches.
        thresholds: { lines: 80, functions: 80, branches: 70, statements: 80 },
      },
    },
  }
})
