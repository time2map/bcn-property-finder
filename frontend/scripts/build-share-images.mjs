import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { createCanvas, GlobalFonts, Path2D } from '@napi-rs/canvas'
import { loadEnv, runnerImport } from 'vite'

// After `vite build` (part of `npm run build`): writes the share pages and pictures (TODO-063)
//   dist/og-image.jpg                  the link preview of the home page
//   dist/share/<profile>/<barri>/      a small page with its own link-preview tags, which sends on to the map
//   dist/share/<profile>/<barri>.jpg   the picture of that page
// Computed with the app's own scoring code from the data files of this build. An optional argument names another
// output folder (then og-image.jpg goes there too).
const root = fileURLToPath(new URL('..', import.meta.url))
const data = (name) => `${root}public/data/${name}`
const outDir = process.argv[2] ?? `${root}dist`
const env = loadEnv('production', root, '')
const siteUrl = (env.VITE_SITE_URL ?? 'https://livability.time2map.com').replace(/\/+$/, '')

// The same Path2D and fonts as the browser's canvas: IBM Plex Sans, the face of the app.
globalThis.Path2D = Path2D
for (const weight of [400, 500, 600, 700]) {
  GlobalFonts.registerFromPath(`${root}node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${weight}-normal.woff`, 'IBM Plex Sans')
}

const opts = { root, configFile: false, mode: 'production', logLevel: 'error' }
const { module: build } = await runnerImport('/src/services/shareImage/shareImageBuild.ts', opts)
const { module: render } = await runnerImport('/src/services/shareImage/shareImageRender.ts', opts)
const { module: areaMap } = await runnerImport('/src/services/shareImage/shareImageAreaMap.ts', opts)
const { module: buildingData } = await runnerImport('/src/services/buildings/buildingData.ts', opts)

const column = (file) => {
  const path = data(buildingData.COLUMN_FILES[file])
  if (!existsSync(path)) return undefined
  const buf = gunzipSync(readFileSync(path))
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
}
const vibePath = data('barri-vibe.json')
const areas = JSON.parse(readFileSync(data('areas.geojson'), 'utf8'))

const t0 = performance.now()
const { results, join } = build.rankProfiles({
  meta: JSON.parse(readFileSync(data('buildings-meta.json'), 'utf8')),
  columns: { scores: column('scores'), positions: column('positions') },
  areas,
  vibe: existsSync(vibePath) ? JSON.parse(readFileSync(vibePath, 'utf8')) : null,
})
const pages = build.sharePages(results)
if (pages.length === 0) throw new Error('share images: no barri ranked')

const make = (w, h) => createCanvas(w, h)
const shapes = render.areaShapes(areas.features)
const jpeg = (canvas) => canvas.toBuffer('image/jpeg', 86)
const idOf = (rank) => join.get(rank.index)?.properties.id

// The home page.
const start = results.find((r) => r.profile === null)
const barriIds = new Set(areas.features.filter((f) => f.properties.kind === 'barri').map((f) => f.properties.id))
mkdirSync(outDir, { recursive: true })
writeFileSync(
  `${outDir}/og-image.jpg`,
  jpeg(await render.renderSiteImage(make, shapes, render.areaFills(start.ranks, join), barriIds, siteUrl)),
)

// Every barri of every profile.
let bytes = 0
for (const page of pages) {
  const areaId = idOf(page.rank)
  if (!areaId) continue
  const ranks = results.find((r) => r.profile?.id === page.profile.id).ranks
  const canvas = await render.renderBarriImage(make, { page, shapes, fill: render.areaFills(ranks, join), areaId }, siteUrl)
  const shape = shapes.find((s) => s.id === areaId)
  const b = areaMap.boundsOf(shape.polygons)
  const image = jpeg(canvas)
  bytes += image.length
  mkdirSync(`${outDir}/share/${page.path}`, { recursive: true })
  writeFileSync(`${outDir}/share/${page.path}.jpg`, image)
  writeFileSync(
    `${outDir}/share/${page.path}/index.html`,
    build.pageHtml(page, siteUrl, { lng: (b.west + b.east) / 2, lat: (b.south + b.north) / 2, zoom: 14 }),
  )
}
console.log(
  `share images: og-image.jpg and ${pages.length} pages (${(bytes / 1024 / 1024).toFixed(1)} MB), ${Math.round(performance.now() - t0)} ms`,
)
