const ICON_COLOR = '#6b7280'

function colorSvg(svg: string, color: string): string {
  return svg.replace('<svg', `<svg fill="${color}"`)
}

export function svgToImage(svg: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(30, 30)
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(colorSvg(svg, ICON_COLOR))
  })
}
