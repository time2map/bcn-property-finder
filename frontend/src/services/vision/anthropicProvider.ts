import Anthropic from '@anthropic-ai/sdk'
import type { ParsedListing } from './types'

const EXTRACTION_PROMPT = `You are extracting structured data from an Idealista (Spanish real estate portal) listing screenshot.

Return ONLY a JSON object with these fields:
- "price": number (EUR, integer) or omit if not visible
- "area": number (m², integer) or omit if not visible
- "address": string (street + neighborhood, best effort) or omit if not visible
- "addressIsApproximate": boolean (true if only neighborhood/district shown, not exact street)
- "url": string (full listing URL if visible anywhere in the screenshot, e.g. in the browser address bar or page — must start with https://) or omit if not visible

Example: {"price":320000,"area":75,"address":"Carrer d'Aragó, Eixample, Barcelona","addressIsApproximate":true,"url":"https://www.idealista.com/inmueble/12345678/"}

Return only the JSON object, no explanation.`

interface AnthropicEnv {
  VITE_ANTHROPIC_API_KEY: string
  VITE_ANTHROPIC_MODEL?: string
}

export async function anthropicParseScreenshot(
  base64: string,
  mimeType: string,
  env: AnthropicEnv,
): Promise<ParsedListing> {
  const client = new Anthropic({
    apiKey: env.VITE_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
  })

  const model = env.VITE_ANTHROPIC_MODEL || 'claude-haiku-4-5'

  const response = await client.messages.create({
    model,
    max_tokens: 256,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
              data: base64,
            },
          },
          { type: 'text', text: EXTRACTION_PROMPT },
        ],
      },
    ],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''
  return parseJsonResponse(text)
}

function parseJsonResponse(text: string): ParsedListing {
  try {
    const match = text.match(/\{[\s\S]*\}/)
    const raw = JSON.parse(match ? match[0] : text)
    const url = typeof raw.url === 'string' && raw.url.startsWith('https://') ? raw.url : undefined
    return {
      price: typeof raw.price === 'number' ? raw.price : undefined,
      area: typeof raw.area === 'number' ? raw.area : undefined,
      address: typeof raw.address === 'string' && raw.address ? raw.address : undefined,
      addressIsApproximate: raw.addressIsApproximate === true,
      url,
    }
  } catch {
    return { addressIsApproximate: false }
  }
}
