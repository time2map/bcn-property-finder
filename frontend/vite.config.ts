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
    base: mode === 'production' ? '/bcn-property-finder/' : '/',
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
          'src/components/PropertyPins/PinLayer.tsx',
        ],
        thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 },
      },
    },
  }
})
