import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Stack, Switch, Text } from '@mantine/core'
import { useStore } from '../../store'
import { DEFAULT_RISK_STRENGTHS, type RiskStrengths } from '../../services/climateRisk/climateRisk'
import { StrengthRow } from './StrengthRow'

const RISKS: (keyof RiskStrengths)[] = ['flood', 'fire', 'street']

/** What only experts need (TODO-052): how much each risk counts, and the colour scale. Closed at first. */
export function AdvancedSettings() {
  const { t } = useTranslation('panel')
  const [open, setOpen] = useState(false)
  const strengths = useStore((s) => s.compositeRiskStrengths)
  const setStrengths = useStore((s) => s.setCompositeRiskStrengths)
  const contrastBoost = useStore((s) => s.contrastBoost)
  const setContrastBoost = useStore((s) => s.setContrastBoost)

  return (
    <div className="advanced-settings">
      <button type="button" className="advanced-settings__head" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {t('advanced.head')}
      </button>
      {open && (
        <Stack gap={12} mt={8}>
          <Text size="xs" c="dimmed">
            {t('advanced.intro')}
          </Text>
          <Stack gap={10}>
            <Text size="xs" fw={600}>{t('advanced.howMuch')}</Text>
            {RISKS.map((id) => (
              <StrengthRow
                key={id}
                label={t(`advanced.${id}`)}
                weight={strengths[id]}
                defaultWeight={DEFAULT_RISK_STRENGTHS[id] || 5}
                onChange={(v) => setStrengths({ ...strengths, [id]: v })}
              />
            ))}
          </Stack>
          <Switch
            size="xs"
            className="ink-control"
            label={t('advanced.boost')}
            checked={contrastBoost}
            onChange={(e) => setContrastBoost(e.currentTarget.checked)}
          />
        </Stack>
      )}
    </div>
  )
}
