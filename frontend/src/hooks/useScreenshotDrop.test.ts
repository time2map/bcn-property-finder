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
vi.mock('./usePinAnalytics', () => ({
  calcAnalytics: vi.fn(),
}))

// Mock stores
const mockAddPin = vi.fn()
const mockUpdatePin = vi.fn()
const mockUpdatePinAnalytics = vi.fn()
vi.mock('../store/pinsStore', () => ({
  usePinsStore: () => ({
    addPin: mockAddPin,
    updatePin: mockUpdatePin,
    updatePinAnalytics: mockUpdatePinAnalytics,
  }),
}))
vi.mock('../store', () => ({
  useStore: () => ({ workplace: [2.17, 41.38] as [number, number] }),
}))

import { parseScreenshot } from '../services/vision/visionService'
import { geocodeAddress } from '../services/geocoding'
import { compressImage, fileToBase64 } from '../services/imageUtils'
import { calcAnalytics } from './usePinAnalytics'

const MOCK_ANALYTICS = { walkingMinutes: 10, calculatedAt: '2024-01-01T00:00:00.000Z' }

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
  vi.mocked(calcAnalytics).mockResolvedValue(MOCK_ANALYTICS)
})

describe('useScreenshotDrop', () => {
  it('happy path: places pin with price, area, photo, address in comment, and geocoded coords', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      price: 320000,
      area: 75,
      address: "Carrer d'Aragó, Eixample",
      addressIsApproximate: false,
      url: 'https://www.idealista.com/inmueble/12345678/',
    })
    vi.mocked(geocodeAddress).mockResolvedValue({ coords: [2.17, 41.39] })

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
      comment: "Carrer d'Aragó, Eixample",
      photos: ['data:image/jpeg;base64,compressed'],
    }))
    expect(mockUpdatePin).toHaveBeenCalledWith('pin-123', expect.objectContaining({ coordinates: [2.17, 41.39] }))
    expect(result.current.state.approxBanner).toBe(false)
    expect(onError).not.toHaveBeenCalled()
  })

  it('calculates analytics with geocoded coords (not fallback)', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      address: 'Calle del Consell de Cent, Eixample',
      addressIsApproximate: false,
    })
    vi.mocked(geocodeAddress).mockResolvedValue({ coords: [2.18, 41.39] })

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))
    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(calcAnalytics).toHaveBeenCalledWith([2.18, 41.39], [2.17, 41.38])
    expect(mockUpdatePinAnalytics).toHaveBeenCalledWith('pin-123', MOCK_ANALYTICS)
  })

  it('calculates analytics with fallback coords when geocoding fails', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      address: 'Unknown Street',
      addressIsApproximate: false,
    })
    vi.mocked(geocodeAddress).mockResolvedValue(null)

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))
    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    // Falls back to workplace coords [2.17, 41.38]
    expect(calcAnalytics).toHaveBeenCalledWith([2.17, 41.38], [2.17, 41.38])
    expect(mockUpdatePinAnalytics).toHaveBeenCalledWith('pin-123', MOCK_ANALYTICS)
    expect(result.current.state.approxBanner).toBe(true)
  })

  it('calculates analytics even when addressIsApproximate is true', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
      address: 'Eixample, Barcelona',
      addressIsApproximate: true,
    })
    vi.mocked(geocodeAddress).mockResolvedValue({ coords: [2.16, 41.38] })

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))
    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(calcAnalytics).toHaveBeenCalledWith([2.16, 41.38], [2.17, 41.38])
    expect(result.current.state.approxBanner).toBe(true)
  })

  it('calculates analytics with fallback when no address parsed', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({ addressIsApproximate: false })

    const { result } = renderHook(() => useScreenshotDrop(vi.fn()))
    await act(async () => {
      await result.current.handleDrop(makeDropEvent(makeImageFile()))
    })

    expect(calcAnalytics).toHaveBeenCalledWith([2.17, 41.38], [2.17, 41.38])
  })

  it('shows approx banner when geocoding fails', async () => {
    vi.mocked(parseScreenshot).mockResolvedValue({
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
      address: 'Eixample',
      addressIsApproximate: true,
    })
    vi.mocked(geocodeAddress).mockResolvedValue({ coords: [2.17, 41.39] })

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
