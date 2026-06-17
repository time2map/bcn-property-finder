import { useEffect, useRef } from 'react'

interface Props {
  min: number
  max: number
  lo: number
  hi: number
  step: number
  minRange: number
  onChange: (range: [number, number]) => void
}

type DragType = 'lo' | 'hi' | 'range'

const HANDLE = 14
const TRACK_H = 4
const BLUE = 'var(--mantine-color-blue-5, #339af0)'
const TRACK_BG = 'var(--mantine-color-gray-2, #e9ecef)'

export function PriceWindowSlider({ min, max, lo, hi, step, minRange, onChange }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ type: DragType; startX: number; startLo: number; startHi: number } | null>(null)
  // Always-fresh props without re-registering listeners
  const propsRef = useRef({ min, max, step, minRange, onChange, lo, hi })
  useEffect(() => { propsRef.current = { min, max, step, minRange, onChange, lo, hi } })

  useEffect(() => {
    const snap = (v: number, s: number) => Math.round(v / s) * s

    const onMove = (clientX: number) => {
      const drag = dragRef.current
      if (!drag || !trackRef.current) return
      const { min, max, step, minRange, onChange } = propsRef.current
      const rect = trackRef.current.getBoundingClientRect()
      const dx = clientX - drag.startX
      const dv = snap((dx / rect.width) * (max - min), step)

      if (drag.type === 'range') {
        const width = drag.startHi - drag.startLo
        const newLo = Math.max(min, Math.min(max - width, drag.startLo + dv))
        onChange([newLo, newLo + width])
      } else if (drag.type === 'lo') {
        const newLo = Math.max(min, Math.min(drag.startHi - minRange, drag.startLo + dv))
        onChange([newLo, drag.startHi])
      } else {
        const newHi = Math.min(max, Math.max(drag.startLo + minRange, drag.startHi + dv))
        onChange([drag.startLo, newHi])
      }
    }

    const onMouseMove = (e: MouseEvent) => onMove(e.clientX)
    const onTouchMove = (e: TouchEvent) => { e.preventDefault(); onMove(e.touches[0].clientX) }
    const onEnd = () => {
      if (!dragRef.current) return
      dragRef.current = null
      document.body.style.cursor = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onEnd)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onEnd)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onEnd)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onEnd)
    }
  }, [])

  const startDrag = (type: DragType, clientX: number) => {
    const { lo, hi } = propsRef.current
    dragRef.current = { type, startX: clientX, startLo: lo, startHi: hi }
    document.body.style.cursor = type === 'range' ? 'grabbing' : 'ew-resize'
  }

  const loPercent = ((lo - min) / (max - min)) * 100
  const hiPercent = ((hi - min) / (max - min)) * 100

  const handleStyle = (pct: number): React.CSSProperties => ({
    position: 'absolute',
    top: '50%',
    left: `${pct}%`,
    width: HANDLE,
    height: HANDLE,
    transform: 'translate(-50%, -50%)',
    background: '#fff',
    border: `2px solid ${BLUE}`,
    borderRadius: '50%',
    cursor: 'ew-resize',
    boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
    zIndex: 2,
    touchAction: 'none',
  })

  return (
    <div style={{ position: 'relative', height: HANDLE + 4, userSelect: 'none' }}>
      {/* Track background */}
      <div
        ref={trackRef}
        style={{
          position: 'absolute', top: '50%', left: 0, right: 0,
          height: TRACK_H, transform: 'translateY(-50%)',
          background: TRACK_BG, borderRadius: 2,
        }}
      >
        {/* Draggable range bar */}
        <div
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrag('range', e.clientX) }}
          onTouchStart={(e) => { e.stopPropagation(); startDrag('range', e.touches[0].clientX) }}
          style={{
            position: 'absolute',
            left: `${loPercent}%`,
            width: `${hiPercent - loPercent}%`,
            height: '100%',
            background: BLUE,
            borderRadius: 2,
            cursor: 'grab',
            touchAction: 'none',
          }}
        />
      </div>

      {/* Lo handle */}
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrag('lo', e.clientX) }}
        onTouchStart={(e) => { e.stopPropagation(); startDrag('lo', e.touches[0].clientX) }}
        style={handleStyle(loPercent)}
      />

      {/* Hi handle */}
      <div
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); startDrag('hi', e.clientX) }}
        onTouchStart={(e) => { e.stopPropagation(); startDrag('hi', e.touches[0].clientX) }}
        style={handleStyle(hiPercent)}
      />
    </div>
  )
}
