import { Group, Stack, Text } from '@mantine/core'
import { useTranslation } from 'react-i18next'
import {
  PROBLEM_LABELS, topProblems, type BarriVibe, type BarriVibeData,
} from '../../services/localsOpinion/localsOpinion'
import { dec1 } from './cardColors'

const PENALTY_COLOR = '#d73027'

export function RiskRow({ label, text, penalty, hint }: { label: string; text: string; penalty: number; hint?: string }) {
  const { t } = useTranslation('card')
  return (
    <div className="risk-row">
      <div className="risk-row__head">
        <i style={{ background: penalty > 0 ? PENALTY_COLOR : '#1a9850' }} aria-hidden />
        <b>{label}</b>
        {penalty > 0 && <span>{t('ui.penalty', { n: penalty })}</span>}
      </div>
      <Text size="xs">{text}</Text>
      {hint && penalty > 0 && <Text size="xs" c="dimmed" fs="italic">{hint}</Text>}
    </div>
  )
}

/** Value next to the city median (median over barris). */
function VsCityRow({ label, value, city, indent }: { label: string; value: string; city: string; indent?: boolean }) {
  const { t } = useTranslation('card')
  return (
    <Group gap={6} wrap="nowrap" pl={indent ? 8 : 0}>
      <Text size="xs" c="dimmed" style={{ flex: 1 }}>{label}</Text>
      <Text size="xs" fw={600}>{value}</Text>
      <Text size="xs" c="dimmed" w={58} ta="right" style={{ fontSize: 10 }}>{t('locals.city', { value: city })}</Text>
    </Group>
  )
}

function trendText(delta: number, noChange: string): string {
  if (delta > 0) return `▲ ${dec1(delta)}`
  if (delta < 0) return `▼ ${dec1(-delta)}`
  return noChange
}

/** "What locals say" — residents' view of the barri, raw survey values (042). */
export function LocalsSay({ barri, data }: { barri: BarriVibe; data: BarriVibeData }) {
  const { t } = useTranslation('card')
  const pct = (v: number | null) => (v === null ? '—' : `${Math.round(v)}%`)
  return (
    <Stack gap={3}>
      <VsCityRow label={t('locals.satisfaction')} value={t('locals.outOf10', { value: dec1(barri.satisf) })} city={dec1(data.city.satisf)} />
      <VsCityRow label={t('locals.stay')} value={pct(barri.stay)} city={pct(data.city.stay)} />
      {!barri.lowN && barri.delta !== null && (
        <Group gap={6} wrap="nowrap">
          <Text size="xs" c="dimmed" style={{ flex: 1 }}>{t('locals.trend')}</Text>
          <Text size="xs" fw={600}>{trendText(barri.delta, t('locals.noChange'))}</Text>
        </Group>
      )}
      <Text size="xs" fw={600} mt={4}>{t('locals.problems')}</Text>
      <div className="chip-list">
        {topProblems(barri).map((p) => (
          <span key={p.id} className="chip-list__chip">
            {PROBLEM_LABELS[p.id]} <b>{pct(p.pct)}</b>
            <span className="chip-list__city"> · {t('locals.city', { value: pct(data.city.problems[p.id]) })}</span>
          </span>
        ))}
      </div>
      <Text size="xs" c="dimmed" style={{ fontSize: 10, opacity: 0.7 }} mt={2}>
        {t('locals.source', { years: data.years, n: barri.n })}
      </Text>
      {barri.lowN && (
        <Text size="xs" c="dimmed" fs="italic" style={{ fontSize: 10 }}>
          {t('locals.smallSample')}
        </Text>
      )}
    </Stack>
  )
}

export function LandmarkRow({ name, minutes }: { name: string; minutes: number }) {
  const { t } = useTranslation('card')
  return (
    <div><dt>{name}</dt><dd>{t('minutes', { n: Math.round(minutes) })}</dd></div>
  )
}

const NOISE_MIN = 40
const NOISE_MAX = 75
/** The noise on a 40–75 dB scale: green below 53, yellow 53–55, orange 55–65, red from 65; a marker at the value. */
export function NoiseBar({ lden }: { lden: number }) {
  const pos = (v: number) => `${Math.max(0, Math.min(100, ((v - NOISE_MIN) / (NOISE_MAX - NOISE_MIN)) * 100))}%`
  return (
    <div className="noise-bar" aria-hidden>
      <i style={{ left: 0, width: pos(53), background: '#1a9850' }} />
      <i style={{ left: pos(53), width: `calc(${pos(55)} - ${pos(53)})`, background: '#fee08b' }} />
      <i style={{ left: pos(55), width: `calc(${pos(65)} - ${pos(55)})`, background: '#fc8d59' }} />
      <i style={{ left: pos(65), right: 0, background: '#d73027' }} />
      <span className="noise-bar__marker" style={{ left: pos(lden) }} />
    </div>
  )
}

/** Small colour-coded label for noise level relative to reference thresholds. */
export function NoiseLabel({ lden }: { lden: number }) {
  const { t } = useTranslation('card')
  let label: string
  let color: string
  let ink = '#1f2937' // dark text on the light tiers, white on the two dark ones (contrast ≥ 4.5:1)
  if (lden < 45) { label = t('noise.veryQuiet'); color = '#15803d'; ink = '#fff' }
  else if (lden < 53) { label = t('noise.quiet'); color = '#91cf60' }
  else if (lden < 55) { label = t('noise.nearWho'); color = '#fee08b' }
  else if (lden < 65) { label = t('noise.aboveEu'); color = '#fc8d59' }
  else { label = t('noise.highly'); color = '#c0392b'; ink = '#fff' }
  return <span className="noise-pill" style={{ background: color, color: ink }}>{label}</span>
}
