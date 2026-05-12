import { Button } from '@mantine/core'
import { useStore } from '../../store'
import { buildIdealistaUrl } from '../../services/idealista'

interface ExportButtonProps {
  isLoading?: boolean
}

export function ExportButton({ isLoading = false }: ExportButtonProps) {
  const resultPolygon = useStore((s) => s.resultPolygon)

  if (!resultPolygon && !isLoading) return null

  function handleClick() {
    if (!resultPolygon || isLoading) return
    window.open(buildIdealistaUrl(resultPolygon), '_blank', 'noopener,noreferrer')
  }

  return (
    <Button
      fullWidth
      disabled={isLoading || !resultPolygon}
      onClick={handleClick}
      style={{ backgroundColor: !isLoading && resultPolygon ? '#F06965' : undefined }}
    >
      Open in Idealista ↗
    </Button>
  )
}
