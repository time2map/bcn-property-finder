import type { ParsedListing } from './types'

const EMPTY: ParsedListing = { addressIsApproximate: false }

export async function parseScreenshot(
  base64: string,
  mimeType: string,
  env = import.meta.env,
): Promise<ParsedListing> {
  // Screenshot/vision is behind a build-time flag. When off (public build) the condition is a
  // static `false`, so the dynamic import below is dead-code-eliminated — the Anthropic SDK
  // (with its Node-only deps and the client API key) never enters the bundle.
  if (import.meta.env.VITE_FEATURE_SCREENSHOT !== 'true') return EMPTY
  try {
    const { anthropicParseScreenshot } = await import('./anthropicProvider')
    return await anthropicParseScreenshot(base64, mimeType, {
      VITE_ANTHROPIC_API_KEY: env.VITE_ANTHROPIC_API_KEY ?? '',
      VITE_ANTHROPIC_MODEL: env.VITE_ANTHROPIC_MODEL,
    })
  } catch {
    return EMPTY
  }
}
