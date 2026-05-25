#!/usr/bin/env node
// Converts FGC GTFS data to two GeoJSON files for map display.
// Usage: node scripts/fgc-gtfs-to-geojson.mjs [gtfs-dir]
// Default gtfs-dir: /tmp/fgc-gtfs
// Output: frontend/public/fgc-lines.geojson, frontend/public/fgc-stations.geojson

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const gtfsDir = process.argv[2] ?? '/tmp/fgc-gtfs'
const outDir = path.resolve(__dirname, '../frontend/public')

function parseCsv(file) {
  const content = fs.readFileSync(path.join(gtfsDir, file), 'utf8')
  const lines = content.trim().split('\n').map((l) => l.replace(/\r$/, ''))
  const headers = lines[0].split(',')
  return lines.slice(1).map((line) => {
    const values = line.split(',')
    return Object.fromEntries(headers.map((h, i) => [h, values[i] ?? '']))
  })
}

// 1. routes: routeId → { color, name }
const routeMap = new Map()
for (const r of parseCsv('routes.txt')) {
  routeMap.set(r.route_id, {
    color: '#' + (r.route_color || '888888'),
    name: r.route_short_name,
  })
}

// 2. trips: tripId → routeId; routeId → Set<shapeId>
const tripToRoute = new Map()
const routeShapes = new Map()
for (const t of parseCsv('trips.txt')) {
  tripToRoute.set(t.trip_id, t.route_id)
  if (!routeShapes.has(t.route_id)) routeShapes.set(t.route_id, new Set())
  routeShapes.get(t.route_id).add(t.shape_id)
}

// 3. shapes: shapeId → sorted [lng, lat] coordinates
const shapePoints = new Map()
for (const s of parseCsv('shapes.txt')) {
  if (!shapePoints.has(s.shape_id)) shapePoints.set(s.shape_id, [])
  shapePoints.get(s.shape_id).push([
    parseFloat(s.shape_pt_lon),
    parseFloat(s.shape_pt_lat),
    parseInt(s.shape_pt_sequence, 10),
  ])
}
for (const [id, pts] of shapePoints) {
  pts.sort((a, b) => a[2] - b[2])
  shapePoints.set(id, pts.map((p) => [p[0], p[1]]))
}

// 4. Lines GeoJSON — one feature per unique shape
const lineFeatures = []
for (const [routeId, shapeIds] of routeShapes) {
  const route = routeMap.get(routeId)
  if (!route) continue
  for (const shapeId of shapeIds) {
    const coords = shapePoints.get(shapeId)
    if (!coords || coords.length < 2) continue
    lineFeatures.push({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: coords },
      properties: { routeId, name: route.name, color: route.color },
    })
  }
}

// 5. Stops: separate parent stations from platforms
const stops = parseCsv('stops.txt')
const platformToParent = new Map()
const parentStops = new Map()
for (const s of stops) {
  if (s.location_type === '1') {
    parentStops.set(s.stop_id, {
      name: s.stop_name,
      lat: parseFloat(s.stop_lat),
      lng: parseFloat(s.stop_lon),
    })
  } else if (s.parent_station) {
    platformToParent.set(s.stop_id, s.parent_station)
  }
}

// 6. stop_times: build platformId → Set<routeId>
const platformRoutes = new Map()
const stopTimesContent = fs.readFileSync(path.join(gtfsDir, 'stop_times.txt'), 'utf8')
const stopTimesLines = stopTimesContent.trim().split('\n')
const stHeaders = stopTimesLines[0].replace(/\r$/, '').split(',')
const tripIdx = stHeaders.indexOf('trip_id')
const stopIdx = stHeaders.indexOf('stop_id')

for (let i = 1; i < stopTimesLines.length; i++) {
  const cols = stopTimesLines[i].split(',')
  const tripId = cols[tripIdx]
  const stopId = cols[stopIdx]
  const routeId = tripToRoute.get(tripId)
  if (!routeId) continue
  if (!platformRoutes.has(stopId)) platformRoutes.set(stopId, new Set())
  platformRoutes.get(stopId).add(routeId)
}

// 7. Aggregate routes to parent stations
const stationRoutes = new Map()
for (const [platformId, routeIds] of platformRoutes) {
  const parentId = platformToParent.get(platformId) ?? platformId
  if (!stationRoutes.has(parentId)) stationRoutes.set(parentId, new Set())
  for (const r of routeIds) stationRoutes.get(parentId).add(r)
}

// 8. Stations GeoJSON
const stationFeatures = []
for (const [stopId, stop] of parentStops) {
  const routeIds = stationRoutes.get(stopId) ?? new Set()
  const firstRouteId = [...routeIds][0]
  const color = firstRouteId ? (routeMap.get(firstRouteId)?.color ?? '#888888') : '#888888'
  stationFeatures.push({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [stop.lng, stop.lat] },
    properties: {
      name: stop.name,
      color,
      routes: [...routeIds].join(','),
    },
  })
}

// Write output
fs.writeFileSync(
  path.join(outDir, 'fgc-lines.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: lineFeatures }),
)
fs.writeFileSync(
  path.join(outDir, 'fgc-stations.geojson'),
  JSON.stringify({ type: 'FeatureCollection', features: stationFeatures }),
)

console.log(`Lines: ${lineFeatures.length} features → frontend/public/fgc-lines.geojson`)
console.log(`Stations: ${stationFeatures.length} features → frontend/public/fgc-stations.geojson`)
