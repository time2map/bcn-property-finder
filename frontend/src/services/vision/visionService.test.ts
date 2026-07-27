import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const MOCK_ENV = {
  VITE_ANTHROPIC_API_KEY: 'test-key',
  VITE_ANTHROPIC_MODEL: 'claude-haiku-4-5',
}

function mockSdk(text: string) {
  vi.doMock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(function () {
      return { messages: { create: vi.fn().mockResolvedValue({ content: [{ type: 'text', text }] }) } }
    }),
  }))
}

function mockSdkError() {
  vi.doMock('@anthropic-ai/sdk', () => ({
    default: vi.fn().mockImplementation(function () {
      return { messages: { create: vi.fn().mockRejectedValue(new Error('API error')) } }
    }),
  }))
}

beforeEach(() => {
  vi.resetModules()
  // parseScreenshot short-circuits unless the screenshot feature flag is on.
  vi.stubEnv('VITE_FEATURE_SCREENSHOT', 'true')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('parseScreenshot', () => {
  it('extracts price, area, address and url from valid API response', async () => {
    const payload = {
      price: 320000,
      area: 75,
      address: "Carrer d'Aragó, Eixample",
      addressIsApproximate: true,
      url: 'https://www.idealista.com/inmueble/12345678/',
    }
    mockSdk(JSON.stringify(payload))
    const { parseScreenshot } = await import('./visionService')

    const result = await parseScreenshot('base64data', 'image/png', MOCK_ENV)

    expect(result.price).toBe(320000)
    expect(result.area).toBe(75)
    expect(result.address).toBe("Carrer d'Aragó, Eixample")
    expect(result.addressIsApproximate).toBe(true)
    expect(result.url).toBe('https://www.idealista.com/inmueble/12345678/')
  })

  it('ignores url that does not start with https://', async () => {
    mockSdk(JSON.stringify({ price: 100000, area: 50, addressIsApproximate: false, url: 'not-a-url' }))
    const { parseScreenshot } = await import('./visionService')

    const result = await parseScreenshot('base64data', 'image/png', MOCK_ENV)

    expect(result.url).toBeUndefined()
  })

  it('returns empty ParsedListing on malformed JSON (no throw)', async () => {
    mockSdk('not json at all')
    const { parseScreenshot } = await import('./visionService')

    const result = await parseScreenshot('base64data', 'image/png', MOCK_ENV)

    expect(result.price).toBeUndefined()
    expect(result.area).toBeUndefined()
    expect(result.addressIsApproximate).toBe(false)
  })

  it('defaults addressIsApproximate to false when absent in response', async () => {
    mockSdk(JSON.stringify({ price: 250000, area: 60 }))
    const { parseScreenshot } = await import('./visionService')

    const result = await parseScreenshot('base64data', 'image/png', MOCK_ENV)

    expect(result.price).toBe(250000)
    expect(result.addressIsApproximate).toBe(false)
  })

  it('returns empty ParsedListing on API error (no throw)', async () => {
    mockSdkError()
    const { parseScreenshot } = await import('./visionService')

    const result = await parseScreenshot('base64data', 'image/png', MOCK_ENV)

    expect(result.price).toBeUndefined()
    expect(result.addressIsApproximate).toBe(false)
  })
})
