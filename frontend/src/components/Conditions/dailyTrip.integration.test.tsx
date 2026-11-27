import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { ConditionsEditor } from './ConditionsEditor'
import { useIsochrone } from '../../hooks/useIsochrone'
import { useStore } from '../../store'
import * as otp from '../../services/otp'
import { renderWithMantine, resetStore } from './testUtils'

vi.mock('../../hooks/useBudgetShares', () => ({ useBudgetShares: () => undefined }))
vi.mock('../../services/otp')

const ZONE = { type: 'MultiPolygon' as const, coordinates: [[[[2.1, 41.3], [2.2, 41.3], [2.2, 41.4], [2.1, 41.3]]]] }

/** The editor and the isochrone hook, as the app mounts them. */
function Harness() {
  useIsochrone()
  return <ConditionsEditor />
}

describe('integration: the daily trip sets the commute zone (078)', () => {
  beforeEach(() => {
    resetStore()
    vi.mocked(otp.fetchOtpIsochrone).mockResolvedValue(ZONE)
  })

  it('"+ Daily trip" asks for the zone of the centre, 30 min; × removes it', async () => {
    renderWithMantine(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: '+ Daily trip' }))
    await waitFor(() => expect(useStore.getState().resultPolygon).toEqual(ZONE))
    expect(otp.fetchOtpIsochrone).toHaveBeenCalledWith([2.17, 41.387], 30)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Daily trip' }))
    expect(useStore.getState().resultPolygon).toBeNull()
    expect(screen.getByRole('button', { name: '+ Daily trip' })).toBeTruthy()
  })
})
