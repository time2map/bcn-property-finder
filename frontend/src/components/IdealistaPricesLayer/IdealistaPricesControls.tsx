import { RangeSlider, SegmentedControl, Stack, Switch, Text } from '@mantine/core'
import { useStore } from '../../store'
import { PRICE_RAMP } from './priceColors'

const DEFAULT_MIN = 200_000
const DEFAULT_MAX = 600_000
const STEP = 25_000

function formatPrice(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M€`
  return `${Math.round(v / 1_000)}k€`
}

export function IdealistaPricesControls() {
  const visible = useStore((s) => s.idealistaPricesVisible)
  const setVisible = useStore((s) => s.setIdealistaPricesVisible)
  const priceRange = useStore((s) => s.idealistaPriceRange)
  const setRange = useStore((s) => s.setIdealistaPriceRange)
  const bounds = useStore((s) => s.idealistaPriceBounds)
  const mode = useStore((s) => s.idealistaPricesMode)
  const setMode = useStore((s) => s.setIdealistaPricesMode)

  const sliderMin = bounds ? Math.floor(bounds[0] / STEP) * STEP : DEFAULT_MIN
  const sliderMax = bounds ? Math.ceil(bounds[1] / STEP) * STEP : DEFAULT_MAX

  return (
    <Stack gap={8}>
      <Switch
        label="Idealista prices"
        size="sm"
        checked={visible}
        onChange={(e) => setVisible(e.currentTarget.checked)}
      />
      {visible && (
        <Stack gap={10} pl={4}>
          <SegmentedControl
            size="xs"
            value={mode}
            onChange={(v) => setMode(v as 'dots' | 'index')}
            data={[
              { label: 'Dots', value: 'dots' },
              { label: 'Index', value: 'index' },
            ]}
            styles={{ root: { '--sc-color': '#9970ab' } as React.CSSProperties }}
          />
          <Text size="xs" c="dimmed">
            {formatPrice(priceRange[0])} – {formatPrice(priceRange[1])}
            {mode === 'index' && <> · median</>}
          </Text>
          <RangeSlider
            min={sliderMin}
            max={sliderMax}
            step={STEP}
            value={priceRange}
            onChange={(v) => setRange(v as [number, number])}
            label={formatPrice}
            minRange={STEP * 2}
            style={{ '--slider-color': '#9970ab' } as React.CSSProperties}
            styles={{ thumb: { borderColor: '#9970ab' } }}
          />
          <div className="price-legend__swatches">
            {PRICE_RAMP.map((color) => (
              <div key={color} className="price-legend__swatch" style={{ background: color }} />
            ))}
          </div>
          <div className="price-legend__labels">
            <Text size="xs" c="dimmed">cheap</Text>
            <Text size="xs" c="dimmed">expensive</Text>
          </div>
        </Stack>
      )}
    </Stack>
  )
}
