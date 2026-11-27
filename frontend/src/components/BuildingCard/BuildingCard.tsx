import { IconX } from '@tabler/icons-react'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { ActionIcon, Group, Paper, Stack, Text, UnstyledButton } from '@mantine/core'
import { settingsOf, URL_DEFAULTS, useStore } from '../../store'
import { valueOf } from '../../services/buildings/buildingData'
import { useBuildingData } from '../../hooks/useBuildingData'
import { buildingArea, scoreBuilding, scoredNoise } from '../../services/buildings/buildingScore'
import { loadBuildingDetail, type BuildingDetailResult } from '../../services/buildings/buildingDetail'
import { prettyAddress, prettyAddresses } from '../../services/buildings/address'
import { eraOf } from '../../services/buildings/buildingAge'
import { LANDMARKS } from '../../services/cityCore/landmarks'
import { SERVICE_CATEGORIES } from '../../services/walkability/serviceCategories'
import { barriVibeData } from '../../services/localsOpinion/localsOpinion'
import { scoreColorForRange } from './cardColors'
import { USE_LABEL, groundFloorWarning } from './buildingCardText'
import { features } from '../../features'
import { BAND_LABEL, BAND_LABEL_POSSIBLY, matchBand, matchSummary, riskLine } from '../../services/match/matchSummary'
import {
  ageParts, ageText, cityCoreParts, cityCoreText, localsParts, localsText, noiseParts, noiseText, poiParts, poiText,
  priceParts, priceText,
} from '../../services/match/matchText'
import { MatchHeader } from './MatchHeader'
import { DetailsView } from './DetailsView'
import { buildingRanks } from '../../services/buildings/buildingRank'
import { useScoreHistograms } from '../../hooks/useScoreHistograms'
import { SaveImageButton } from './SaveImageButton'
import { ShareLinkButton } from './ShareLinkButton'
import { buildingLinkUrl } from '../../services/buildingLink'
import { encodeConfig } from '../../services/urlConfig'
import { buildingShareModel } from '../../services/shareImage/shareImageModel'
import { useSheetSlots } from '../MobileSheet/sheetSlots'

/**
 * The title of the card: the first address, and the others behind "+N more addresses". A block of flats can have
 * dozens of addresses (one per entrance and street); the list opens in place and scrolls past a few lines.
 */
function AddressTitle({ addresses, fallback, size }: { addresses: string[]; fallback: string; size: 'sm' | 'md' }) {
  const { t } = useTranslation('card')
  const [open, setOpen] = useState(false)
  if (addresses.length === 0) return <Text size={size} fw={700}>{fallback}</Text>
  const more = addresses.length - 1
  return (
    <Stack gap={2} data-testid="address-title">
      <Text size={size} fw={700}>{addresses[0]}</Text>
      {more > 0 && !open && (
        <UnstyledButton onClick={() => setOpen(true)} data-testid="address-more" aria-expanded={false}>
          <Text size="xs" c="blue.7" fw={500}>{t('ui.moreAddresses', { count: more })}</Text>
        </UnstyledButton>
      )}
      {more > 0 && open && (
        <>
          <Stack gap={1} data-testid="address-list" style={{ maxHeight: 96, overflowY: 'auto' }}>
            {addresses.slice(1).map((a) => <Text key={a} size="xs" c="dimmed">{a}</Text>)}
          </Stack>
          <UnstyledButton onClick={() => setOpen(false)} aria-expanded>
            <Text size="xs" c="blue.7" fw={500}>{t('ui.fewerAddresses')}</Text>
          </UnstyledButton>
        </>
      )}
    </Stack>
  )
}

/**
 * The building card. On desktop a card over the top right of the map. With `embedded` (the phone layout, TODO-062)
 * it fills the slots of the bottom sheet instead: a two-line header for peek (address, match) and the details
 * below it.
 */
export function BuildingCard({ embedded = false }: { embedded?: boolean }) {
  const { t } = useTranslation('card')
  const slots = useSheetSlots()
  const selected = useStore((s) => s.selectedBuilding)
  const setSelected = useStore((s) => s.setSelectedBuilding)
  const weights = useStore((s) => s.compositeWeights)
  const enabledLandmarkIds = useStore((s) => s.enabledLandmarkIds)
  const enabledCategories = useStore((s) => s.enabledWalkCategories)
  const riskStrengths = useStore((s) => s.compositeRiskStrengths)
  const ageEras = useStore((s) => s.ageEras)
  const conditions = useStore((s) => s.conditions)
  const [sMin, sMax] = useStore((s) => s.compositeColorRange)
  const [loaded, setLoaded] = useState<{ i: number; result: BuildingDetailResult } | null>(null)
  const histograms = useScoreHistograms()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setSelected])

  // A new building starts at the top of the sheet's body.
  const sheetBody = slots.body
  useEffect(() => {
    const scroller = sheetBody?.closest('.mobile-sheet__body')
    if (scroller) scroller.scrollTop = 0
  }, [selected, sheetBody])

  // The positions may arrive a moment after the buildings are coloured (TODO-058): the card shows once they are in.
  const data = useBuildingData(selected !== null)
  useEffect(() => {
    if (selected === null || !data) return
    let cancelled = false
    loadBuildingDetail(selected, data.cols.lng[selected], data.cols.lat[selected])
      .then((result) => { if (!cancelled) setLoaded({ i: selected, result }) })
      .catch((err) => console.error('Building card failed to load', err))
    return () => { cancelled = true }
  }, [selected, data])

  if (selected === null || !data) return null

  const vibe = features.localsOpinion ? barriVibeData : null
  const composite = scoreBuilding(data, selected, {
    weights, conditions, enabledLandmarkIds, enabledCategories, riskStrengths, ageEras, vibe,
  })
  const { score, components, penalties } = composite
  const lden = scoredNoise(data, selected)
  const services = SERVICE_CATEGORIES.filter((c) => enabledCategories.includes(c.id))
    .map((cat) => ({ cat, minutes: valueOf(data, `min_${cat.id}`, selected) }))
  const placeMinutes = enabledLandmarkIds.map((id) => valueOf(data, `cc_${id}`, selected))
  const yearBuilt = valueOf(data, 'year_built', selected)
  const area = buildingArea(data, selected)
  const areaPrices = data.meta.areas
    .filter((a) => a.kind === area?.kind && typeof a.price === 'number')
    .map((a) => a.price as number)
  const barri = area?.kind === 'barri' && vibe ? vibe.barris[area.code] : undefined
  const result = loaded?.i === selected ? loaded.result : null
  const d = result?.detail ?? null
  const riskShown = riskStrengths.flood > 0 || riskStrengths.fire > 0 || riskStrengths.street > 0
  const warning = d && groundFloorWarning(d.street_t10_cm, d.street_t100_cm, d.river_zone, d.floors_below)
  const color = scoreColorForRange(score, sMin, sMax)
  const withinMin = (minutes: readonly (number | null)[], limit: number) =>
    minutes.filter((m) => m !== null && m <= limit).length
  const summary = matchSummary(composite, weights, {
    noise: lden !== null ? noiseText(lden, conditions.noiseMaxDb) : undefined,
    poiAccess: poiText(withinMin(services.map((x) => x.minutes), conditions.walkMaxMin), services.length, conditions.walkMaxMin),
    cityCore: cityCoreText(withinMin(placeMinutes, conditions.cityCoreMaxMin), placeMinutes.length, conditions.cityCoreMaxMin),
    openPrice: area?.price != null ? priceText(area.price, conditions.priceMaxEurM2) : undefined,
    localsOpinion: barri ? localsText(barri.satisfAdj, conditions.localsMin) : undefined,
    age: ageText(yearBuilt !== null ? eraOf(yearBuilt).name : null),
  }, {
    noise: lden !== null ? noiseParts(lden, conditions.noiseMaxDb) : undefined,
    poiAccess: poiParts(withinMin(services.map((x) => x.minutes), conditions.walkMaxMin), services.length, conditions.walkMaxMin),
    cityCore: cityCoreParts(withinMin(placeMinutes, conditions.cityCoreMaxMin), placeMinutes.length, conditions.cityCoreMaxMin),
    openPrice: area?.price != null ? priceParts(area.price, conditions.priceMaxEurM2) : undefined,
    localsOpinion: barri ? localsParts(barri.satisfAdj, conditions.localsMin) : undefined,
    age: ageParts(yearBuilt !== null ? eraOf(yearBuilt).name : null),
  })
  // No award when the budget ceiling set the score (TODO-073): in an expensive barri many homes share the ceiling,
  // and "among the best" would praise a home that is over the budget.
  const ranks = histograms && !composite.hasGap && composite.budgetCap === 0 && summary.total > 0
    ? buildingRanks(histograms, data.meta.areas, valueOf(data, 'area', selected), score) : null
  const riskText = riskLine(penalties, { flood: d?.river_zone ? t('river.zoneYear', { year: d.river_zone }) : undefined })
  const landmarks = enabledLandmarkIds
    .map((id) => ({ id, name: LANDMARKS.find((l) => l.id === id)?.name ?? id, minutes: valueOf(data, `cc_${id}`, selected) }))
    .filter((e): e is { id: string; name: string; minutes: number } => e.minutes !== null)
    .sort((a, b) => a.minutes - b.minutes)

  const address = prettyAddress(d?.address) ?? (d ? t('ui.buildingTitle') : t('ui.loading'))
  const shownScore = composite.hasGap && composite.scoreMin < score ? `${composite.scoreMin}–${score}` : String(score)
  const buildingPos: [number, number] = [data.cols.lng[selected], data.cols.lat[selected]]
  const buildingLink = () => buildingLinkUrl(
    window.location.href, encodeConfig(settingsOf(useStore.getState()), URL_DEFAULTS), buildingPos)
  const details = (
    <Stack gap="sm">
      <MatchHeader
        score={score} scoreMin={composite.scoreMin} incomplete={composite.hasGap}
        summary={summary} color={color} compact={embedded} ranks={ranks} overBudget={composite.budgetCap > 0}
      />

      {d && (
        <SaveImageButton
          lngLat={buildingPos}
          build={(profile) => buildingShareModel({
            address: prettyAddress(d.address), area, score, summary, riskText, profile, ranks,
          })}
          link={buildingLink}
          extra={<ShareLinkButton getUrl={buildingLink} copied={t('shareCopied.building')} />}
        />
      )}

      <DetailsView
          d={d} facades={result?.facades ?? []} weights={weights} components={components} penalties={penalties}
          conditions={conditions} riskStrengths={riskStrengths} riskShown={riskShown} warning={warning}
          lden={lden} yearBuilt={yearBuilt} services={services} placeMinutes={placeMinutes} landmarks={landmarks}
          area={area} barri={barri} barriData={features.localsOpinion ? barriVibeData : null} areaPrices={areaPrices}
        />
    </Stack>
  )

  if (embedded) {
    if (!slots.header || !slots.body) return null
    const peekAddresses = prettyAddresses(d?.address)
    const peek = (
      <Group justify="space-between" align="center" wrap="nowrap" className="building-peek">
        <div className="match-ring match-ring--small" data-incomplete={composite.hasGap} data-long={shownScore.length > 3}
          style={{ '--ring-color': color, '--ring-pct': `${score}%` } as React.CSSProperties}>
          <span>{shownScore}</span>
        </div>
        <Stack gap={2} style={{ minWidth: 0, flex: 1 }}>
          <Text fw={600} size="md" truncate>
            {peekAddresses[0] ?? address}
            {peekAddresses.length > 1 && <Text span size="sm" fw={500} c="dimmed">{` +${peekAddresses.length - 1}`}</Text>}
          </Text>
          <Text size="sm" fw={500} data-testid="peek-match">
            {(shownScore.includes('–') ? BAND_LABEL_POSSIBLY : BAND_LABEL)[matchBand(score)]}
            {summary.total === 0 && <Text span size="sm" fw={500} c="dimmed">{' · '}{t('ui.peekNone')}</Text>}
          </Text>
        </Stack>
        <ActionIcon size={44} radius="md" variant="subtle" color="gray" onClick={() => setSelected(null)}
          aria-label={t('ui.closeBuilding')} style={{ flex: 'none', marginRight: -8 }}>
          <IconX size={24} stroke={2} />
        </ActionIcon>
      </Group>
    )
    return (
      <>
        {createPortal(peek, slots.header)}
        {createPortal(<div className="building-card__body building-card__body--sheet">{details}</div>, slots.body)}
      </>
    )
  }

  return (
    <div className="building-card-overlay">
      <Paper shadow="md" radius="md" w={300} className="building-card">
        {/* The header stays in view while the details scroll under it. */}
        <Group justify="space-between" align="flex-start" wrap="nowrap" className="building-card__header">
          <Stack gap={0}>
            <AddressTitle key={d?.id} addresses={prettyAddresses(d?.address)} fallback={address} size="sm" />
            {d && (
              <Text size="xs" c="dimmed">
                {d.student ? t('ui.studentResidence') : USE_LABEL[d.use ?? ''] ?? t('use.other')}
              </Text>
            )}
          </Stack>
          <ActionIcon size={36} radius="md" variant="subtle" color="gray" onClick={() => setSelected(null)}
            aria-label={t('ui.closeBuilding')} style={{ flex: 'none', marginTop: -6, marginRight: -8 }}>
            <IconX size={24} stroke={2} />
          </ActionIcon>
        </Group>
        <div className="building-card__body">
{details}
        </div>
      </Paper>
    </div>
  )
}
