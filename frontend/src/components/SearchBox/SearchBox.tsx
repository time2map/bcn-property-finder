import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { ActionIcon, Combobox, Loader, TextInput, useCombobox } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import { loadAreas, type AreaFeature } from '../../services/areas'
import { searchAreas, areaIdsBounds } from '../../services/areaSearch'
import { searchAddresses, type AddressSuggestion } from '../../services/geocoding'
import { SEARCH_DEBOUNCE_MS, SEARCH_MAX_RESULTS, SEARCH_MIN_CHARS } from '../../services/searchConfig'
import { useSearchStore } from '../../store/searchStore'
import { useSheetStore } from '../../store/sheetStore'

/**
 * "Search an area or address" (044), opened by the search button of the brand bar: districts, barris, municipalities and colloquial names
 * from the areas dataset, plus Geoapify address suggestions. Writes the pick to the search store; the
 * map side is SearchLayer.
 *
 * On a phone, after the onboarding, it is the search pill (TODO-062): always there, with the product name as its
 * placeholder, a mark on the left (`leftSlot`) and the share button on the right (`rightSlot`) until something is
 * typed. The results then take the screen (CSS: .search-results).
 */
export function SearchBox({ pill = false, leftSlot, rightSlot }: {
  pill?: boolean
  leftSlot?: ReactNode
  rightSlot?: ReactNode
}) {
  const { t } = useTranslation('panel')
  const { t: tl } = useTranslation('legal')
  const inputRef = useRef<HTMLInputElement>(null)
  const [areas, setAreas] = useState<AreaFeature[]>([])
  const [text, setText] = useState('')
  const [addresses, setAddresses] = useState<AddressSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const selection = useSearchStore((s) => s.selection)
  const selectArea = useSearchStore((s) => s.selectArea)
  const selectAddress = useSearchStore((s) => s.selectAddress)
  const clear = useSearchStore((s) => s.clear)
  const open = useSearchStore((s) => s.open)
  const setOpen = useSearchStore((s) => s.setOpen)
  const combobox = useCombobox()

  useEffect(() => { loadAreas().then(setAreas) }, [])

  // Escape (handled in SearchLayer) empties the selection: empty the field with it.
  const hadSelection = useRef(false)
  useEffect(() => {
    if (hadSelection.current && !selection) setText('')
    hadSelection.current = selection !== null
  }, [selection])

  // Closed: forget what was typed.
  useEffect(() => {
    if (!open && !pill) { setText(''); setAddresses([]) }
  }, [open, pill])

  const query = text.trim()
  const areaMatches = useMemo(() => searchAreas(areas, query, SEARCH_MAX_RESULTS), [areas, query])

  useEffect(() => {
    if (query.length < SEARCH_MIN_CHARS) {
      setAddresses([])
      setLoading(false)
      return
    }
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(() => {
      searchAddresses(query, controller.signal, SEARCH_MAX_RESULTS).then((r) => {
        if (controller.signal.aborted) return
        setAddresses(r)
        setLoading(false)
      })
    }, SEARCH_DEBOUNCE_MS)
    return () => { clearTimeout(timer); controller.abort() }
  }, [query])

  const pick = (value: string) => {
    const [type, idx] = value.split(':')
    if (type === 'area') {
      const m = areaMatches[Number(idx)]
      const bounds = areaIdsBounds(areas, m.areaIds)
      if (!bounds) return
      const outline = {
        type: 'FeatureCollection' as const,
        features: areas.filter((a) => m.areaIds.includes(a.properties.id)),
      }
      selectArea(m.label, bounds, outline)
      setText(m.label)
    } else {
      const a = addresses[Number(idx)]
      selectAddress(a.label, a.coords)
      setText(a.label)
    }
    combobox.closeDropdown()
    if (pill) {
      inputRef.current?.blur() // the keyboard goes away, the map shows the pick
      useSheetStore.getState().setPosition('peek')
    }
  }

  const reset = () => {
    setText('')
    setAddresses([])
    clear()
  }

  const close = () => { reset(); if (pill) inputRef.current?.blur(); else setOpen(false) }

  const showEmpty = query.length >= SEARCH_MIN_CHARS && !loading && areaMatches.length === 0 && addresses.length === 0

  if (!open && !pill) return null

  return (
    <Combobox store={combobox} onOptionSubmit={pick} withinPortal={false}>
      <Combobox.Target>
        <TextInput
          ref={inputRef}
          className={pill ? 'glass-panel search-box search-box--pill' : 'glass-panel search-box'}
          size="md"
          radius="lg"
          placeholder={pill ? t('search.pill') : t('search.field')}
          aria-label={t('search.aria')}
          autoFocus={!pill}
          enterKeyHint="search"
          autoComplete="off"
          leftSection={loading ? <Loader size={14} /> : pill ? leftSlot : null}
          leftSectionWidth={pill ? 52 : undefined}
          rightSection={pill && text === '' ? rightSlot : (
            <ActionIcon variant="subtle" color="gray" size="md" aria-label={t('search.close')} onClick={close}>
              <IconX size={16} />
            </ActionIcon>
          )}
          rightSectionWidth={pill ? 52 : undefined}
          leftSectionPointerEvents={pill ? "all" : undefined}
          rightSectionPointerEvents="all"
          value={text}
          onChange={(e) => { setText(e.currentTarget.value); combobox.openDropdown() }}
          onKeyDown={(e) => { if (e.key === 'Escape') close() }}
          onFocus={() => combobox.openDropdown()}
          onBlur={() => combobox.closeDropdown()}
        />
      </Combobox.Target>
      <Combobox.Dropdown className="search-results" hidden={query.length === 0}>
        <Combobox.Options>
          {areaMatches.length > 0 && (
            <Combobox.Group label={t('search.areas')}>
              {areaMatches.map((m, i) => (
                <Combobox.Option key={m.areaIds.join('|')} value={`area:${i}`}>
                  <div>{m.label}</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>{m.hint}</div>
                </Combobox.Option>
              ))}
            </Combobox.Group>
          )}
          {addresses.length > 0 && (
            <Combobox.Group label={t('search.addresses')}>
              {addresses.map((a, i) => (
                <Combobox.Option key={`${a.label}${i}`} value={`addr:${i}`}>{a.label}</Combobox.Option>
              ))}
            </Combobox.Group>
          )}
          {addresses.length > 0 && (
            // Geoapify's Free plan requires its credit next to the results, plus OpenStreetMap (TODO-066)
            <div style={{ fontSize: 10, opacity: 0.6, padding: '4px 8px' }}>{tl('context.geoapify')}</div>
          )}
          {showEmpty && <Combobox.Empty>{t('search.empty')}</Combobox.Empty>}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
