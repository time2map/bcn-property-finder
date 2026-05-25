import type { ParsedListing } from './types'
import { anthropicParseScreenshot } from './anthropicProvider'

export async function parseScreenshot(
  base64: string,
  mimeType: string,
  env = import.meta.env,
): Promise<ParsedListing> {
  try {
    return await anthropicParseScreenshot(base64, mimeType, {
      VITE_ANTHROPIC_API_KEY: env.VITE_ANTHROPIC_API_KEY ?? '',
      VITE_ANTHROPIC_MODEL: env.VITE_ANTHROPIC_MODEL,
    })
  } catch {
    return { addressIsApproximate: false }
  }
}
