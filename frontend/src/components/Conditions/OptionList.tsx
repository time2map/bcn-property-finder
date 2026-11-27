import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Slider } from '@mantine/core'

export interface Choice<T extends string | number> {
  value: T
  label: string
  hint?: string
}

export interface CustomSlider {
  min: number
  max: number
  step: number
  format: (v: number) => string
  onChange: (v: number) => void
}

/** 3–4 verbal steps and, for numbers, "Custom…" with a slider for the values in between. */
export function OptionList<T extends string | number>({ options, value, onChange, custom }: {
  options: readonly Choice<T>[]
  value: T
  onChange: (v: T) => void
  custom?: CustomSlider
}) {
  const { t } = useTranslation('editor')
  const isCustom = custom !== undefined && !options.some((o) => o.value === value)
  const [showSlider, setShowSlider] = useState(isCustom)
  return (
    <div role="radiogroup" className="option-list">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="option-list__item"
          onClick={() => onChange(o.value)}
        >
          <span>{o.label}</span>
          {o.hint && <small>{o.hint}</small>}
        </button>
      ))}
      {custom && (
        <>
          <button
            type="button"
            role="radio"
            aria-checked={isCustom}
            className="option-list__item"
            onClick={() => setShowSlider(true)}
          >
            <span>{t('picker.custom')}</span>
            {isCustom && <small>{custom.format(Number(value))}</small>}
          </button>
          {showSlider && (
            <div className="option-list__custom">
              <div className="option-list__custom-head">
                <span>{t('picker.customValue')}</span>
                <b>{custom.format(Number(value))}</b>
              </div>
              <Slider
                className="word-slider"
                min={custom.min}
                max={custom.max}
                step={custom.step}
                value={Number(value)}
                onChange={custom.onChange}
                label={null}
                size={4}
                thumbSize={18}
                aria-label={t('picker.customValue')}
                style={{ '--slider-color': '#F06965' } as React.CSSProperties}
              />
              <div className="option-list__custom-range">
                <span>{custom.format(custom.min)}</span>
                <span>{custom.format(custom.max)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
