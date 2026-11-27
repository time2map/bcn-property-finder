import { defineConfig } from 'vitest/config'
import { loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { dataVersion } from './scripts/dataVersion.mjs'

/** The preload of buildings-meta.json in index.html must ask for the same versioned address as the app. */
function versionDataPreloads(version: string): Plugin {
  return {
    name: 'version-data-preloads',
    transformIndexHtml(html) {
      return html.replace(/(data\/buildings-meta\.json)"/g, `$1?v=${version}"`)
    },
  }
}

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

// Preloads that exist only in the production build (TODO-058). The map is loaded with a dynamic import, so that it
// runs after the first paint; its chunks are still needed by every visitor: index.html preloads them, and
// `npm run check:bundle` counts them. area-start.json is written after `vite build` (scripts/build-area-start.mjs;
// the dev server has none).
function preloadMapChunks(base: string, version: string): Plugin {
  return {
    name: 'preload-map-chunks',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(_html, ctx) {
        const chunks = Object.values(ctx.bundle ?? {})
          .filter((c) => c.type === 'chunk' && ['Map', 'maplibre'].includes(c.name))
          .map((c) => ({
            tag: 'link',
            attrs: { rel: 'modulepreload', crossorigin: true, href: base + c.fileName },
            injectTo: 'head' as const,
          }))
        const areaStart = {
          tag: 'link',
          attrs: { rel: 'preload', as: 'fetch', crossorigin: true, href: `${base}data/area-start.json?v=${version}` },
          injectTo: 'head' as const,
        }
        return [...chunks, areaStart]
      },
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  // Never stub under test — vitest runs in Node (Node builtins resolve) and needs the real
  // specifier for vi.doMock to intercept.
  const stub = mode !== 'test' && env.VITE_FEATURE_SCREENSHOT !== 'true'
  const version = dataVersion()

  return {
    plugins: [
      react(), ...(stub ? [stubAnthropicSdk()] : []), preloadMapChunks(env.VITE_BASE || '/', version),
      versionDataPreloads(version),
    ],
    define: { 'import.meta.env.VITE_DATA_VERSION': JSON.stringify(version) },
    // '/' for the custom domain; a fork on github.io/<repo>/ sets VITE_BASE=/<repo>/ (see deploy.yml).
    base: env.VITE_BASE || '/',
    // The scoring worker is an ES module (TODO-058).
    worker: { format: 'es' as const },
    build: {
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: [
              { name: 'maplibre', test: /node_modules[\\/]maplibre-gl/ },
              { name: 'mantine', test: /node_modules[\\/]@mantine/ },
              { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
              { name: 'icons', test: /node_modules[\\/]@tabler/ },
              { name: 'h3', test: /node_modules[\\/]h3-js/ },
              { name: 'tiles', test: /node_modules[\\/](pmtiles|pbf|@mapbox)/ },
              { name: 'draw', test: /node_modules[\\/]terra-draw/ },
            ],
          },
        },
      },
    },
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
