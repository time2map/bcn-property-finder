import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deliverImage, renderShareBlob } from './shareImageBrowser'
import type { ShareModel } from './shareImageModel'

const blob = new Blob(['png'], { type: 'image/png' })

function setPhone(matches: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches }) as never
}

describe('deliverImage', () => {
  let click: ReturnType<typeof vi.fn>
  beforeEach(() => {
    click = vi.fn()
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click)
    URL.createObjectURL = vi.fn(() => 'blob:x')
    URL.revokeObjectURL = vi.fn()
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete (navigator as { share?: unknown }).share
    delete (navigator as { canShare?: unknown }).canShare
  })

  it('downloads the picture on a computer, under a plain file name', async () => {
    setPhone(false)
    const names: string[] = []
    vi.spyOn(document.body, 'appendChild').mockImplementation(((el: HTMLAnchorElement) => { names.push(el.download); return el }) as never)
    expect(await deliverImage(blob, 'Carrer Tenerife', 'https://x.test/?c=default')).toBe('saved')
    expect(click).toHaveBeenCalledTimes(1)
    expect(names).toEqual(['barcelona-livability-carrer-tenerife.png'])
  })

  it('opens the share sheet with the picture and the link on a phone that can share files', async () => {
    setPhone(true)
    const share = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { share, canShare: () => true })
    expect(await deliverImage(blob, 'Carrer Tenerife', 'https://x.test/?c=default')).toBe('shared')
    const arg = share.mock.calls[0][0]
    expect(arg.files[0].name).toBe('barcelona-livability-carrer-tenerife.png')
    expect(arg.text).toBe('https://x.test/?c=default')
    expect(click).not.toHaveBeenCalled()
  })

  it('does nothing more when the person closes the share sheet', async () => {
    setPhone(true)
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new DOMException('x', 'AbortError')), canShare: () => true })
    expect(await deliverImage(blob, 'x', 'u')).toBe('cancelled')
    expect(click).not.toHaveBeenCalled()
  })

  it('downloads when sharing fails for another reason, or files cannot be shared', async () => {
    setPhone(true)
    Object.assign(navigator, { share: vi.fn().mockRejectedValue(new Error('boom')), canShare: () => true })
    expect(await deliverImage(blob, 'x', 'u')).toBe('saved')
    delete (navigator as { share?: unknown }).share
    Object.assign(navigator, { canShare: () => false })
    expect(await deliverImage(blob, 'x', 'u')).toBe('saved')
    expect(click).toHaveBeenCalledTimes(2)
  })
})

describe('renderShareBlob', () => {
  it('fails clearly when the browser has no 2D canvas', async () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
    const model = { rows: [] } as unknown as ShareModel
    await expect(renderShareBlob({} as never, [2, 41], model)).rejects.toThrow('No 2D canvas')
  })
})
