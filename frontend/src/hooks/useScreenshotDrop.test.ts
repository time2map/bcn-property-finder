import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScreenshotDrop } from './useScreenshotDrop'

// Mock services
vi.mock('../services/vision/visionService', () => ({
  parseScreenshot: vi.fn(),
}))
vi.mock('../services/geocoding', () => ({
  geocodeAddress: vi.fn(),
}))
vi.mock('../services/imageUtils', () => ({
  compressImage: vi.fn(),
  fileToBase64: vi.fn(),
}))

// Mock stores
const mockAddPin = vi.fn()
const mockUpdatePin = vi.fn()
vi.mock('../store/pinsStore', () => ({
  usePinsStore: () => ({ addPin: mockAddPin, updatePin: mockUpdatePin }),
}))
vi.mock('../store', () => ({
  useStore: () => ({ workplace: null }),
}))

import { parseScreenshot } from '../services/vision/visionService'
import { geocodeAddress } from '../services/geocoding'
import { compressImage, fileToBase64 } from '../services/imageUtils'

function makeDropEvent(file: File): React.DragEvent {
  return {
    preventDefault: vi.fn(),
    currentTarget: { contains: () => false },
    relatedTarget: null,
    dataTransfer: {
      dropEffect: '',
      files: [file] as unknown as FileList,
    },
  } as unknown as React.DragEvent
}

function makeImageFile(name = 'screenshot.png') {
  return new File(['data'], name, { type: 'image/png' })
}

beforeEach(() => {
  vi.clearAllMocks()
  mockAddPin.mockReturnValue('pin-123')
  vi.mocked(fileToBase64).mockResolvedValue('base64data')
  vi.mocked(compressImage).mockResolvedValue('data:image/jpeg;base64,compressed')
})

describe('useScreenshotDrop', () => {
  it('happy path: places pin with price, area, photo and geocoded coords', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      price: 320000,
      area: 75,
      address: 'Carrer d\'Aragó, Eixample',
      addressIsApproximate: false,
      url: 'https://www.idealista.com/inmueble/12345678/',
    })
    vi.mocked(geocodeAddress).mockResolvedValue([2.17, 41.39])

    const onError = vi.fn()
    const { result } = renderHook(() => useScreenshotDrop(onError))

    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(mockAddPin).toHaveBeenCalledOnce()
    expect(mockUpdatePin).toHaveBeenCalledWith('pin-123', expect.objectContaining({
      price: 320000,
      area: 75,
      url: 'https://www.idealista.com/inmueble/12345678/',
      photos: ['data:image/jpeg;base64,compressed'],
    }))
    expect(mockUpdatePin).toHaveBeenCalledWith('pin-123', { coordinates: [2.17, 41.39] })
    expect(result.current.state.approxBanner).toBe(false)
    expect(onError).not.toHaveBeenCalled()
  })

  it('shows approx banner when geocoding fails', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      price: 200000,
      area: 50,
      address: 'Unknown Street',
      addressIsApproximate: false,
    })
    vi.mocked(geocodeAddress).mockResolvedValue(null)

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))

    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(result.current.state.approxBanner).toBe(true)
  })

  it('shows approx banner when addressIsApproximate is true', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      price: 200000,
      area: 50,
      address: 'Eixample',
      addressIsApproximate: true,
    })
    vi.mocked(geocodeAddress).mockResolvedValue([2.17, 41.39])

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))

    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(result.current.state.approxBanner).toBe(true)
  })

  it('shows approx banner when no address in parsed result', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      addressIsApproximate: false,
    })
    vi.mocked(geocodeAddress).mockResolvedValue(null)

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))

    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(result.current.state.approxBanner).toBe(true)
  })

  it('calls onError and does not crash when parseScreenshot throws', async () => {
    vi.mocked(parseScreenshot).mockRejectedValue(new Error('Vision failed'))

    const onError = vi.fn()
    const { result } = renderHook(() => useScreenshotDrop(onError))

    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(onError).toHaveBeenCalledWith('Could not read screenshot — pin placed at map center')
    expect(result.current.state.isProcessing).toBe(false)
  })

  it('dismissBanner clears the approx banner', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({ addressIsApproximate: false })

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))

    // Force banner on by dropping with no address
    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })
    expect(result.current.state.approxBanner).toBe(true)

    act(() => result.current.dismissBanner())
    expect(result.current.state.approxBanner).toBe(false)
  })

  it('ignores non-image files', async () => {
    const csvFile = new File(['data'], 'file.csv', { type: 'text/csv' })
    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))

    await act(async () => {
      await result.current.handleDrop(makeDropEvent(csvFile))
    })

    expect(mockAddPin).not.toHaveBeenCalled()
  })
})
