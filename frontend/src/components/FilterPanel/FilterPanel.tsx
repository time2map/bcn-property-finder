import { useTranslation } from 'react-i18next'
import { Divider, Paper, Stack, Switch, Tabs } from '@mantine/core'
import { useStore } from '../../store'
import { useSheetStore } from '../../store/sheetStore'
import { NoiseLegend } from '../NoiseLayer/NoiseLegend'
import { ClimateLayerControls } from './ClimateLayerControls'
import { CompositeControls } from './CompositeControls'
import { IdealistaPricesControls } from '../IdealistaPricesLayer/IdealistaPricesControls'
import { ExclusionControls } from './ExclusionControls'
import { YourConditionsRow } from './YourConditionsRow'
import { AreasList } from '../AreasList/AreasList'
import { ConditionsEditor } from '../Conditions/ConditionsEditor'
import { MapLayersControl } from './MapLayersControl'
import { MatchColoursSwitch } from './MatchColoursSwitch'
import { AdvancedSettings } from './AdvancedSettings'
import { BestAreasControls } from '../BestZones/BestAreasControls'
import { features } from '../../features'

/** The conditions panel: a glass panel on desktop; with `embedded` (the phone's bottom sheet) just its content. */
export function FilterPanel({ embedded = false }: { embedded?: boolean }) {
  const { noiseLayerVisible, setNoiseLayerVisible } = useStore()
  const { t } = useTranslation('panel')
  const tab = useSheetStore((s) => s.tab)
  const setTab = useSheetStore((s) => s.setTab)

  return (
    <Paper
      className={embedded ? 'filter-panel--sheet' : 'glass-panel'}
      p={embedded ? 0 : 'md'}
      radius="md"
      // The tabs stay put; only the body below them scrolls (the panel on desktop). In the phone's sheet the sheet scrolls.
      style={embedded
        ? { background: 'transparent', boxShadow: 'none' }
        : { minHeight: 0, display: 'flex', flexDirection: 'column', flex: '0 1 auto', overflow: 'hidden' }}
    >
      {features.areas && (
        <Tabs value={tab} onChange={(v) => setTab(v === 'areas' ? 'areas' : 'settings')} mb="sm" style={{ flex: 'none' }}>
          <Tabs.List grow>
            <Tabs.Tab value="settings">{t('tabs.settings')}</Tabs.Tab>
            <Tabs.Tab value="areas">{t('tabs.areas')}</Tabs.Tab>
          </Tabs.List>
        </Tabs>
      )}
      <div className="filter-panel__body">
      {features.areas && tab === 'areas' ? <AreasList /> : (
      <Stack gap="md">
          {!embedded && <YourConditionsRow />}
          {features.idealistaPrices && (
            <>
              <IdealistaPricesControls />
              <Divider />
            </>
          )}

          {features.exclusions && (
            <>
              <ExclusionControls />
              <Divider />
            </>
          )}

          {features.onboarding ? (
            <>
              <ConditionsEditor />
              <MatchColoursSwitch />
              <Divider />
              <MapLayersControl />
              {features.bestZones && (
                <>
                  <Divider />
                  <BestAreasControls />
                </>
              )}
              <AdvancedSettings />
            </>
          ) : (
            <>
              <Switch
                label="Noise areas"
                size="sm"
                checked={noiseLayerVisible}
                onChange={(e) => setNoiseLayerVisible(e.currentTarget.checked)}
              />
              <NoiseLegend />
              <ClimateLayerControls />

              <Divider />
              <CompositeControls />
            </>
          )}

      </Stack>
      )}
      </div>
    </Paper>
  )
}
