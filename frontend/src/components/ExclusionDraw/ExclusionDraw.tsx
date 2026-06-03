import { useEffect, useRef } from 'react'
import { TerraDraw, TerraDrawPolygonMode, TerraDrawFreehandMode } from 'terra-draw'
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter'
import type { Polygon } from 'geojson'
import { useMap } from '../Map/MapContext'
import { useExclusionsStore } from '../../store/exclusionsStore'

/**
 * Drives terra-draw for hand-drawn exclusion zones.
 * A finished polygon is stored as a `drawn` exclusion zone (rendered by ExclusionLayer),
 * then cleared from the draw layer and drawing mode is exited.
 */
export function ExclusionDraw() {
  const map = useMap()
  const drawingMode = useExclusionsStore((s) => s.drawingMode)
  const setDrawingMode = useExclusionsStore((s) => s.setDrawingMode)
  const addZone = useExclusionsStore((s) => s.addZone)
  const drawRef = useRef<TerraDraw | null>(null)

  useEffect(() => {
    if (!map) return

    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map }),
      modes: [new TerraDrawPolygonMode(), new TerraDrawFreehandMode()],
    })
    drawRef.current = draw

    const onFinish = (id: string | number) => {
      const feature = draw.getSnapshot().find((f) => f.id === id)
      if (feature && feature.geometry.type === 'Polygon') {
        addZone({ name: 'Drawn zone', source: 'drawn', geometry: feature.geometry as Polygon })
      }
      draw.clear()
      setDrawingMode(null)
    }
    draw.on('finish', onFinish)

    return () => {
      draw.off('finish', onFinish)
      if (draw.enabled) draw.stop()
      drawRef.current = null
    }
  }, [map]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const draw = drawRef.current
    if (!draw) return
    if (drawingMode) {
      if (!draw.enabled) draw.start()
      draw.setMode(drawingMode)
    } else if (draw.enabled) {
      draw.clear()
      draw.stop()
    }
  }, [drawingMode])

  // Esc exits drawing mode
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawingMode(null)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setDrawingMode])

  return null
}
