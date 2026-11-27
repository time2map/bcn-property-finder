import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Checkbox, Text } from '@mantine/core'

export interface CheckItem {
  id: string
  label: string
  hint?: string
}

/**
 * Pick several of a list. The "All" box toggles every tick: all on → all off → all on. A condition needs at
 * least one thing to measure, so an empty selection is only a draft: it is not saved until something is ticked,
 * and until then the map keeps the last real choice.
 */
export function CheckList({ items, selected, onChange, allLabel }: {
  items: readonly CheckItem[]
  selected: readonly string[]
  onChange: (ids: string[]) => void
  allLabel: string
}) {
  const { t } = useTranslation('editor')
  // null = follow the saved selection; [] = the person cleared everything and has not ticked anything yet.
  const [draft, setDraft] = useState<string[] | null>(null)
  const current = draft ?? selected
  const ids = items.map((i) => i.id)
  const allSelected = ids.every((id) => current.includes(id))

  const commit = (next: string[]) => {
    if (next.length > 0) {
      onChange(next)
      setDraft(null)
    } else {
      setDraft([])
    }
  }
  const toggle = (id: string) => {
    // Keep the list order.
    commit(ids.filter((x) => (x === id ? !current.includes(x) : current.includes(x))))
  }

  return (
    <div className="check-list">
      <Checkbox
        className="ink-control"
        label={allLabel}
        checked={allSelected}
        indeterminate={!allSelected && current.length > 0}
        onChange={() => commit(allSelected ? [] : ids)}
        styles={{ label: { fontWeight: 600 } }}
      />
      {items.map((i) => (
        <Checkbox
          key={i.id}
          className="ink-control"
          label={i.hint ? `${i.label} · ${i.hint}` : i.label}
          checked={current.includes(i.id)}
          onChange={() => toggle(i.id)}
        />
      ))}
      {current.length === 0 && (
        <Text size="xs" c="dimmed">{t('picker.tickOne')}</Text>
      )}
    </div>
  )
}
