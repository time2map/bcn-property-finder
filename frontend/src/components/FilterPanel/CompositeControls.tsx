import { useState } from 'react'
import { ActionIcon, Checkbox, Group, Modal, Slider, Stack, Switch, Text } from '@mantine/core'
import { IconSettings, IconInfoCircle } from '@tabler/icons-react'
import { useStore, ALL_WALK_CATEGORY_IDS, type CompositeWeights } from '../../store'
import { LANDMARKS, ALL_LANDMARK_IDS } from '../../services/cityCore/landmarks'
import { SERVICE_CATEGORIES } from '../../services/walkability/serviceCategories'
import { DEFAULT_RISK_STRENGTHS, type RiskStrengths } from '../../services/climateRisk/climateRisk'
import { CompositeLegend } from '../BuildingsLayer/CompositeLegend'
import { StrengthRow } from './StrengthRow'
import { LivabilityInfoModal } from './LivabilityInfoModal'
import { AGE_ERAS, ALL_AGE_ERA_IDS } from '../../services/buildings/buildingAge'
import {
  CONDITION_RANGES, noiseAnchor,
  type Conditions,
} from '../../services/buildings/conditions'
import { features } from '../../features'

const fmt = (n: number) => new Intl.NumberFormat('en-ES', { maximumFractionDigits: 0 }).format(n)

interface GearButtonProps {
  onClick: () => void
  label: string
}

function GearButton({ onClick, label }: GearButtonProps) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '0 2px', color: '#868e96', lineHeight: 0, display: 'inline-flex',
      }}
    >
      <IconSettings size={15} stroke={1.8} />
    </button>
  )
}

interface ConditionRowProps {
  label: string
  on: boolean
  onToggle: (on: boolean) => void
  onGear?: () => void
  /** The limit in real units; absent for conditions set in the gear modal only (building age). */
  limit?: { value: number; range: { min: number; max: number; step: number }; onChange: (value: number) => void }
  /** What is OK for the user, in their words. */
  sentence: string
}

/** A Livability condition in real units (049): on / off, the limit, and the sentence it amounts to. */
function ConditionRow({ label, on, onToggle, onGear, limit, sentence }: ConditionRowProps) {
  return (
    <Stack gap={4}>
      <Group gap={6} wrap="nowrap">
        <Checkbox
          size="xs"
          checked={on}
          onChange={(e) => onToggle(e.currentTarget.checked)}
          aria-label={`Enable ${label}`}
        />
        <Text size="xs" style={{ flex: 1 }}>{label}</Text>
        {on && onGear && <GearButton onClick={onGear} label={`Configure ${label}`} />}
      </Group>
      {on && limit && (
        <Slider
          {...limit.range}
          size="xs"
          value={limit.value}
          onChange={limit.onChange}
          label={null}
          aria-label={`${label} limit`}
          style={{ '--slider-color': '#F06965' } as React.CSSProperties}
        />
      )}
      {on && <Text size="xs" c="dimmed">{sentence}</Text>}
    </Stack>
  )
}

export function CompositeControls() {
  const visible = useStore((s) => s.compositeVisible)
  const setVisible = useStore((s) => s.setCompositeVisible)
  const contrastBoost = useStore((s) => s.contrastBoost)
  const setContrastBoost = useStore((s) => s.setContrastBoost)
  const weights = useStore((s) => s.compositeWeights)
  const setWeights = useStore((s) => s.setCompositeWeights)
  const enabledIds = useStore((s) => s.enabledLandmarkIds)
  const setEnabledIds = useStore((s) => s.setEnabledLandmarkIds)
  const riskStrengths = useStore((s) => s.compositeRiskStrengths)
  const setRiskStrengths = useStore((s) => s.setCompositeRiskStrengths)
  const walkCategories = useStore((s) => s.enabledWalkCategories)
  const setWalkCategories = useStore((s) => s.setEnabledWalkCategories)
  const ageEras = useStore((s) => s.ageEras)
  const setAgeEras = useStore((s) => s.setAgeEras)
  const conditions = useStore((s) => s.conditions)
  const setConditions = useStore((s) => s.setConditions)

  const [cityModalOpen, setCityModalOpen] = useState(false)
  const [walkModalOpen, setWalkModalOpen] = useState(false)
  const [ageModalOpen, setAgeModalOpen] = useState(false)
  const [infoModalOpen, setInfoModalOpen] = useState(false)

  function conditionRow(id: keyof CompositeWeights, limitKey?: keyof Conditions) {
    return {
      on: (weights[id] ?? 0) > 0,
      onToggle: (on: boolean) => setWeights({ ...weights, [id]: on ? 1 : 0 }),
      limit: limitKey && {
        value: conditions[limitKey],
        range: CONDITION_RANGES[limitKey],
        onChange: (value: number) => setConditions({ ...conditions, [limitKey]: value }),
      },
    }
  }

  function riskRow(id: keyof RiskStrengths) {
    return {
      weight: riskStrengths[id],
      defaultWeight: DEFAULT_RISK_STRENGTHS[id] || 5,
      onChange: (value: number) => setRiskStrengths({ ...riskStrengths, [id]: value }),
    }
  }

  function toggleLandmark(id: string, checked: boolean) {
    if (checked) {
      setEnabledIds([...enabledIds, id])
    } else {
      const next = enabledIds.filter((i) => i !== id)
      if (next.length > 0) setEnabledIds(next)
    }
  }

  function toggleWalkCategory(id: string, checked: boolean) {
    const next = checked ? [...walkCategories, id] : walkCategories.filter((i) => i !== id)
    if (next.length > 0) setWalkCategories(next)
  }

  function toggleAgeEra(id: string, checked: boolean) {
    const next = checked ? ALL_AGE_ERA_IDS.filter((i) => i === id || ageEras.includes(i)) : ageEras.filter((i) => i !== id)
    if (next.length > 0) setAgeEras(next)
  }

  const services = walkCategories.length === ALL_WALK_CATEGORY_IDS.length
    ? 'Everyday services'
    : `My ${walkCategories.length} service${walkCategories.length > 1 ? 's' : ''}`
  const places = enabledIds.length > 1 ? 'My places' : 'My place'
  const ageScale = ageEras.length === ALL_AGE_ERA_IDS.length
    ? "All eras count — untick the ones you don't want"
    : `Liked: ${AGE_ERAS.filter((e) => ageEras.includes(e.id)).map((e) => e.years).join(', ')}`

  return (
    <>
      <LivabilityInfoModal opened={infoModalOpen} onClose={() => setInfoModalOpen(false)} />

      <Modal
        opened={cityModalOpen}
        onClose={() => setCityModalOpen(false)}
        title="City Core landmarks"
        size="sm"
      >
        <Stack gap={6} pb={8}>
          {LANDMARKS.map((lm) => (
            <Checkbox
              key={lm.id}
              label={lm.name}
              size="xs"
              checked={enabledIds.includes(lm.id)}
              onChange={(e) => toggleLandmark(lm.id, e.currentTarget.checked)}
            />
          ))}
          <Checkbox
            label="All landmarks"
            size="xs"
            checked={enabledIds.length === ALL_LANDMARK_IDS.length}
            indeterminate={enabledIds.length > 0 && enabledIds.length < ALL_LANDMARK_IDS.length}
            onChange={(e) =>
              setEnabledIds(e.currentTarget.checked ? ALL_LANDMARK_IDS : [ALL_LANDMARK_IDS[0]])
            }
            styles={{ root: { borderTop: '1px solid #eee', paddingTop: 6, marginTop: 4 } }}
          />
        </Stack>
      </Modal>

      <Modal
        opened={walkModalOpen}
        onClose={() => setWalkModalOpen(false)}
        title="Walkability services"
        size="sm"
      >
        <Stack gap={6} pb={8}>
          {SERVICE_CATEGORIES.map((cat) => (
            <Checkbox
              key={cat.id}
              label={`${cat.emoji} ${cat.label}`}
              size="xs"
              checked={walkCategories.includes(cat.id)}
              onChange={(e) => toggleWalkCategory(cat.id, e.currentTarget.checked)}
            />
          ))}
          <Checkbox
            label="All services"
            size="xs"
            checked={walkCategories.length === ALL_WALK_CATEGORY_IDS.length}
            indeterminate={walkCategories.length > 0 && walkCategories.length < ALL_WALK_CATEGORY_IDS.length}
            onChange={(e) =>
              setWalkCategories(e.currentTarget.checked ? ALL_WALK_CATEGORY_IDS : [ALL_WALK_CATEGORY_IDS[0]])
            }
            styles={{ root: { borderTop: '1px solid #eee', paddingTop: 6, marginTop: 4 } }}
          />
        </Stack>
      </Modal>

      <Modal
        opened={ageModalOpen}
        onClose={() => setAgeModalOpen(false)}
        title="Building age — eras you like"
        size="sm"
      >
        <Stack gap={8} pb={8}>
          {AGE_ERAS.map((era) => (
            <Checkbox
              key={era.id}
              label={`${era.name} · ${era.years}`}
              description={era.about}
              size="xs"
              checked={ageEras.includes(era.id)}
              onChange={(e) => toggleAgeEra(era.id, e.currentTarget.checked)}
            />
          ))}
          <Checkbox
            label="All eras"
            size="xs"
            checked={ageEras.length === ALL_AGE_ERA_IDS.length}
            indeterminate={ageEras.length > 0 && ageEras.length < ALL_AGE_ERA_IDS.length}
            onChange={(e) => setAgeEras(e.currentTarget.checked ? ALL_AGE_ERA_IDS : [ALL_AGE_ERA_IDS[0]])}
            styles={{ root: { borderTop: '1px solid #eee', paddingTop: 6, marginTop: 4 } }}
          />
        </Stack>
      </Modal>

      <Stack gap={8}>
        <Group gap={4} wrap="nowrap" align="center">
          <Switch
            label="Match score"
            size="sm"
            checked={visible}
            onChange={(e) => setVisible(e.currentTarget.checked)}
            style={{ flex: 1 }}
          />
          <ActionIcon
            size={16}
            variant="subtle"
            color="gray"
            onClick={() => setInfoModalOpen(true)}
            aria-label="About the match score"
          >
            <IconInfoCircle size={16} stroke={1.8} />
          </ActionIcon>
        </Group>
        {visible && (
          <Stack gap={10} pl={28}>
            <ConditionRow label="Services on foot" {...conditionRow('poiAccess', 'walkMaxMin')}
              onGear={() => setWalkModalOpen(true)}
              sentence={`${services} within ${conditions.walkMaxMin} min walk`} />
            <ConditionRow label="Noise on the street side" {...conditionRow('noise', 'noiseMaxDb')}
              sentence={`Up to ${conditions.noiseMaxDb} dB on the street side is OK for me — like ${noiseAnchor(conditions.noiseMaxDb)}`} />
            <ConditionRow label="City Core Access" {...conditionRow('cityCore', 'cityCoreMaxMin')}
              onGear={() => setCityModalOpen(true)}
              sentence={`${places} within ${conditions.cityCoreMaxMin} min walk`} />
            <ConditionRow label="Market Price" {...conditionRow('openPrice', 'priceMaxEurM2')}
              sentence={`I'm ready to pay up to €${fmt(conditions.priceMaxEurM2)}/m²`} />
            {features.localsOpinion && (
              <ConditionRow label="Locals' opinion" {...conditionRow('localsOpinion', 'localsMin')}
                sentence={`Residents rate their barri at least ${conditions.localsMin.toFixed(1)} / 10`} />
            )}
            <ConditionRow label="Building age" {...conditionRow('age')}
              onGear={() => setAgeModalOpen(true)} sentence={ageScale} />

            <Text size="xs" c="dimmed" mt={2}>Risk penalties</Text>
            <StrengthRow label="River flood risk" {...riskRow('flood')} />
            <StrengthRow label="Wildfire risk" {...riskRow('fire')} />
            <StrengthRow label="Street flooding risk" {...riskRow('street')} />

            <CompositeLegend />
            <Switch
              size="xs"
              label="Boost contrast for this view"
              checked={contrastBoost}
              onChange={(e) => setContrastBoost(e.currentTarget.checked)}
            />
            <Text size="xs" c="dimmed">Hatched = incomplete data (score is a range, colour shows the best case)</Text>
          </Stack>
        )}
      </Stack>
    </>
  )
}
