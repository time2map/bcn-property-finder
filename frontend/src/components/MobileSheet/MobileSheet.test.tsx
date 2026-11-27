import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createPortal } from 'react-dom'
import { MobileSheet } from './MobileSheet'
import { useSheetSlots } from './sheetSlots'
import { useSheetStore } from '../../store/sheetStore'
import { sheetHeights } from '../../services/sheetSnap'

const reset = () => useSheetStore.setState({ position: 'peek', mapInset: 0, tab: 'settings', pickedArea: null, restore: null })

function BuildingBits() {
  const { header, body } = useSheetSlots()
  if (!header || !body) return null
  return <>{createPortal(<b>Carrer Varsovia 142</b>, header)}{createPortal(<p>Walkability</p>, body)}</>
}

function setup(view: 'main' | 'building' = 'main') {
  return render(
    <MobileSheet view={view} header={<span>Quiet · On foot</span>} main={<p>Conditions editor</p>} floating={<i>Legend</i>}>
      <BuildingBits />
    </MobileSheet>,
  )
}

const sheet = () => screen.getByRole('region', { name: 'Conditions and details' })
const H = sheetHeights(window.innerHeight)

/** A pointer event at height `y` and time `t` (jsdom cannot set the time through fireEvent). */
function pointer(el: Element, type: 'down' | 'move' | 'up', y: number, t: number) {
  const ev = new PointerEvent(`pointer${type}`, { clientY: y, pointerId: 1, bubbles: true })
  Object.defineProperty(ev, 'timeStamp', { value: t })
  act(() => { el.dispatchEvent(ev) })
}

describe('MobileSheet', () => {
  beforeEach(reset)

  it('starts at peek with the header and the main view', () => {
    setup()
    expect(sheet()).toHaveAttribute('data-position', 'peek')
    expect(screen.getByText('Quiet · On foot')).toBeVisible()
    expect(screen.getByText('Conditions editor')).toBeInTheDocument()
  })

  it('carries the floating legend and buttons with it', () => {
    setup()
    expect(sheet()).toContainElement(screen.getByText('Legend'))
  })

  it('shows the building view in the slots and hides the conditions', () => {
    setup('building')
    expect(screen.getByText('Carrer Varsovia 142')).toBeVisible()
    expect(screen.getByText('Walkability')).toBeVisible()
    expect(screen.getByText('Quiet · On foot')).not.toBeVisible()
    expect(screen.getByText('Conditions editor')).not.toBeVisible()
  })

  it('moves peek → half → full → peek when the handle is tapped', () => {
    setup()
    const handle = screen.getByRole('button', { name: 'Open the panel' })
    fireEvent.click(handle)
    expect(sheet()).toHaveAttribute('data-position', 'half')
    fireEvent.click(screen.getByRole('button', { name: 'Expand the panel' }))
    expect(sheet()).toHaveAttribute('data-position', 'full')
    fireEvent.click(screen.getByRole('button', { name: 'Collapse the panel' }))
    expect(sheet()).toHaveAttribute('data-position', 'peek')
  })

  it('puts the sheet at its position: only peek is above the bottom edge at peek', () => {
    setup()
    expect(sheet().style.transform).toBe(`translateY(${H.full - H.peek}px)`)
    fireEvent.click(screen.getByRole('button', { name: 'Open the panel' }))
    expect(sheet().style.transform).toBe(`translateY(${H.full - H.half}px)`)
  })

  it('tells the map how far to move up', () => {
    setup()
    expect(useSheetStore.getState().mapInset).toBe(H.peek)
    fireEvent.click(screen.getByRole('button', { name: 'Open the panel' }))
    fireEvent.click(screen.getByRole('button', { name: 'Expand the panel' }))
    expect(useSheetStore.getState().mapInset).toBe(H.half) // at full the map keeps the half inset
  })

  it('follows a drag by the header and settles on the nearest position', () => {
    setup()
    const grab = screen.getByText('Quiet · On foot').parentElement!.parentElement!
    pointer(grab, 'down', 600, 0)
    pointer(grab, 'move', 400, 600)
    expect(sheet().getAttribute('data-dragging')).toBe('true')
    pointer(grab, 'up', 400, 900)
    // peek + 200 px = ~304 px: nearest to half
    expect(sheet()).toHaveAttribute('data-position', 'half')
    expect(sheet().getAttribute('data-dragging')).toBe('false')
  })

  it('a flick up goes one position further, however short', () => {
    setup()
    const grab = screen.getByText('Quiet · On foot').parentElement!.parentElement!
    pointer(grab, 'down', 600, 0)
    pointer(grab, 'move', 570, 30)
    pointer(grab, 'up', 570, 40)
    expect(sheet()).toHaveAttribute('data-position', 'half')
  })

  it('treats a small movement as a tap, not a drag: a tap on the small sheet opens it halfway', () => {
    setup()
    const grab = screen.getByText('Quiet · On foot').parentElement!.parentElement!
    pointer(grab, 'down', 600, 0)
    pointer(grab, 'move', 598, 20)
    expect(sheet().getAttribute('data-dragging')).toBe('false')
    pointer(grab, 'up', 598, 40)
    expect(sheet()).toHaveAttribute('data-position', 'half')
  })

  it('a tap on a button inside the small sheet presses the button and does not open it', () => {
    render(
      <MobileSheet view="main" header={<button type="button">Back to the list</button>} main={<p>Conditions editor</p>} />,
    )
    const button = screen.getByRole('button', { name: 'Back to the list' })
    pointer(button, 'down', 600, 0)
    pointer(button, 'up', 600, 40)
    expect(sheet()).toHaveAttribute('data-position', 'peek')
  })

  it('a tap on the building header opens it halfway; a tap when already open does nothing', () => {
    setup('building')
    const address = screen.getByText('Carrer Varsovia 142')
    pointer(address, 'down', 600, 0)
    pointer(address, 'up', 600, 40)
    expect(sheet()).toHaveAttribute('data-position', 'half')
    pointer(address, 'down', 400, 100)
    pointer(address, 'up', 400, 140)
    expect(sheet()).toHaveAttribute('data-position', 'half')
  })

  it('a cancelled touch (the browser took it for scrolling) does not open the sheet', () => {
    setup()
    const grab = screen.getByText('Quiet · On foot').parentElement!.parentElement!
    pointer(grab, 'down', 600, 0)
    const ev = new PointerEvent('pointercancel', { clientY: 600, pointerId: 1, bubbles: true })
    act(() => { grab.dispatchEvent(ev) })
    expect(sheet()).toHaveAttribute('data-position', 'peek')
  })

  it('the body drags the sheet while it is not at full, and scrolls at full', () => {
    setup()
    const body = screen.getByText('Conditions editor').parentElement!.parentElement!
    pointer(body, 'down', 500, 0)
    pointer(body, 'move', 300, 500)
    pointer(body, 'up', 300, 900)
    expect(sheet()).toHaveAttribute('data-position', 'half')
    useSheetStore.setState({ position: 'full' })
    pointer(body, 'down', 500, 1000)
    pointer(body, 'move', 700, 1500)
    pointer(body, 'up', 700, 1900)
    expect(sheet()).toHaveAttribute('data-position', 'full') // no drag handlers on the body at full
  })
})
