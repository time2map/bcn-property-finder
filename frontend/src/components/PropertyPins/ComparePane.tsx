import { usePinsStore } from '../../store/pinsStore'
import { useSplitPane } from '../../hooks/useSplitPane'
import { CompareGrid } from './CompareGrid'

interface ComparePaneProps {
  /** Mobile full-screen mode: no resizer, no collapse, fills its container. */
  fullScreen?: boolean
}

export function ComparePane({ fullScreen = false }: ComparePaneProps) {
  const count = usePinsStore((s) => s.pins.length)
  const { width, collapsed, isDragging, toggleCollapsed, startDrag } = useSplitPane()

  // Mobile: always full grid, no chrome resizer.
  if (fullScreen) {
    return (
      <section className="compare-pane compare-pane--full">
        <div className="compare-pane__body">
          {count === 0
            ? <div className="compare-pane__empty">No apartments yet. Add one from the map.</div>
            : <CompareGrid />}
        </div>
      </section>
    )
  }

  // Desktop: hidden entirely when there's nothing to compare.
  if (count === 0) return null

  if (collapsed) {
    return (
      <button
        className="compare-pane compare-pane--rail"
        onClick={toggleCollapsed}
        aria-label="Expand comparison panel"
      >
        <span className="compare-pane__rail-label">Compare ({count})</span>
        <span className="compare-pane__rail-chevron">›</span>
      </button>
    )
  }

  return (
    <section
      className={`compare-pane${isDragging ? ' compare-pane--dragging' : ''}`}
      style={{ width }}
    >
      <header className="compare-pane__head">
        <span className="compare-pane__title">Compare ({count})</span>
        <button
          className="compare-pane__collapse"
          onClick={toggleCollapsed}
          aria-label="Collapse comparison panel"
        >
          ‹
        </button>
      </header>

      <div className="compare-pane__body">
        <CompareGrid />
      </div>

      <div
        className="compare-pane__divider"
        onPointerDown={startDrag}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize comparison panel"
      />
    </section>
  )
}
