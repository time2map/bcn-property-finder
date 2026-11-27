import type { ReactNode } from 'react'
import { render } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { useStore, DEFAULT_COMPOSITE_WEIGHTS, ALL_WALK_CATEGORY_IDS } from '../../store'
import { DEFAULT_CONDITIONS } from '../../services/buildings/conditions'
import { ALL_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import { ALL_AGE_ERA_IDS } from '../../services/buildings/buildingAge'

/** Store at the app defaults, with the onboarding open and nothing saved. */
export function resetStore(): void {
  localStorage.clear()
  useStore.setState({
    compositeWeights: { ...DEFAULT_COMPOSITE_WEIGHTS },
    conditions: { ...DEFAULT_CONDITIONS },
    flatAreaM2: 70,
    enabledWalkCategories: ALL_WALK_CATEGORY_IDS,
    enabledLandmarkIds: ALL_LANDMARK_IDS,
    ageEras: ALL_AGE_ERA_IDS,
    compositeRiskStrengths: { flood: 5, fire: 5, street: 5 },
    conditionOrder: ['noise', 'poiAccess', 'cityCore', 'openPrice', 'risk'],
    buildingScores: null,
    onboarded: false,
    onboardingOpen: true,
  })
}

export function renderWithMantine(ui: ReactNode) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}
