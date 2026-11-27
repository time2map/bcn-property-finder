import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { screen, fireEvent } from '@testing-library/react'
import { CheckList } from './CheckList'
import { renderWithMantine } from './testUtils'

const ITEMS = [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta', hint: 'second' }, { id: 'c', label: 'Gamma' }]

/** A parent that keeps the saved selection, like the store does. */
function Harness({ start, onChange }: { start: string[]; onChange: (ids: string[]) => void }) {
  const [selected, setSelected] = useState(start)
  return <CheckList items={ITEMS} selected={selected} allLabel="All of them" onChange={(ids) => { setSelected(ids); onChange(ids) }} />
}
const box = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement
const ticks = () => ['Alpha', 'Beta · second', 'Gamma'].map((n) => box(n).checked)

describe('CheckList', () => {
  it('"All" is ticked when everything is, half-ticked when only some are', () => {
    const { unmount } = renderWithMantine(<Harness start={['a', 'b', 'c']} onChange={() => {}} />)
    expect(box('All of them').checked).toBe(true)
    unmount()
    renderWithMantine(<Harness start={['a']} onChange={() => {}} />)
    expect(box('All of them').checked).toBe(false)
    expect(box('All of them').indeterminate).toBe(true)
  })

  it('"All" toggles: everything on → every tick off → everything on again', () => {
    const onChange = vi.fn()
    renderWithMantine(<Harness start={['a', 'b', 'c']} onChange={onChange} />)
    fireEvent.click(box('All of them'))
    expect(ticks()).toEqual([false, false, false])
    expect(box('All of them').checked).toBe(false)
    expect(screen.getByText(/Tick at least one/)).toBeTruthy()
    expect(onChange).not.toHaveBeenCalled() // an empty selection is not saved
    fireEvent.click(box('All of them'))
    expect(ticks()).toEqual([true, true, true])
    expect(onChange).toHaveBeenLastCalledWith(['a', 'b', 'c'])
    expect(screen.queryByText(/Tick at least one/)).toBeNull()
  })

  it('"All" with some ticked selects everything', () => {
    const onChange = vi.fn()
    renderWithMantine(<Harness start={['b']} onChange={onChange} />)
    fireEvent.click(box('All of them'))
    expect(onChange).toHaveBeenCalledWith(['a', 'b', 'c'])
    expect(ticks()).toEqual([true, true, true])
  })

  it('after clearing, ticking one saves just that one', () => {
    const onChange = vi.fn()
    renderWithMantine(<Harness start={['a', 'b', 'c']} onChange={onChange} />)
    fireEvent.click(box('All of them'))
    fireEvent.click(box('Gamma'))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(['c'])
    expect(ticks()).toEqual([false, false, true])
  })

  it('unticking the last one is a draft too: nothing is saved', () => {
    const onChange = vi.fn()
    renderWithMantine(<Harness start={['b']} onChange={onChange} />)
    fireEvent.click(box('Beta · second'))
    expect(ticks()).toEqual([false, false, false])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('saves in list order', () => {
    const onChange = vi.fn()
    renderWithMantine(<Harness start={['c']} onChange={onChange} />)
    fireEvent.click(box('Alpha'))
    expect(onChange).toHaveBeenCalledWith(['a', 'c'])
  })
})
