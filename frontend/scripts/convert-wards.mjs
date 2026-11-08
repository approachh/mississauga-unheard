// Converts the City of Mississauga's official ward boundaries into compact SVG shapes.
//
//   npm run data:wards   (reads frontend/data/wards/raw/ward_boundaries.geojson,
//                         fetching it from the City's ArcGIS service if missing;
//                         writes frontend/public/data/ward_shapes.json)
//
// Source: "Ward Boundaries", City of Mississauga Open Data (ArcGIS item f1cad02b3a40422dac2ea99b59cc36a5),
// https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/Ward_Boundaries/FeatureServer/2
//
// Processing (documented so the map stays verifiable):
// - Only the ward number is kept; councillor names, phone numbers etc. are dropped.
// - Longitude/latitude are projected to a local equirectangular plane (x scaled by cos of the
//   mean latitude), north up. At city scale the distortion is negligible.
// - Rings are simplified with Douglas–Peucker at TOLERANCE_M metres, well below one screen pixel.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const rawPath = join(here, '..', 'data', 'wards', 'raw', 'ward_boundaries.geojson')
const outPath = join(here, '..', 'public', 'data', 'ward_shapes.json')
const SERVICE = 'https://services6.arcgis.com/hM5ymMLbxIyWTjn2/arcgis/rest/services/Ward_Boundaries/FeatureServer/2'
const TOLERANCE_M = 4
const WIDTH = 1000

if (!existsSync(rawPath)) {
  console.log('Fetching ward boundaries from the City of Mississauga service…')
  const res = await fetch(`${SERVICE}/query?where=1%3D1&outFields=WARD&outSR=4326&f=geojson`)
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
  mkdirSync(dirname(rawPath), { recursive: true })
  writeFileSync(rawPath, await res.text())
}

const geo = JSON.parse(readFileSync(rawPath, 'utf8'))
const features = geo.features.filter((f) => f.geometry && /Polygon/.test(f.geometry.type))
if (features.length !== 11) throw new Error(`Expected 11 wards, found ${features.length}`)

// Polygons as arrays of rings of [lon, lat].
const polys = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)

let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity
for (const f of features)
  for (const poly of polys(f.geometry))
    for (const ring of poly)
      for (const [lon, lat] of ring) {
        minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon)
        minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat)
      }

const lat0 = ((minLat + maxLat) / 2) * (Math.PI / 180)
const kx = Math.cos(lat0)
const spanX = (maxLon - minLon) * kx
const spanY = maxLat - minLat
const scale = WIDTH / spanX
const HEIGHT = Math.round(spanY * scale)
const metresPerUnit = (spanX * 111_320) / WIDTH // ~metres per SVG unit
const tol = TOLERANCE_M / metresPerUnit

const project = ([lon, lat]) => [(lon - minLon) * kx * scale, (maxLat - lat) * scale]

function simplify(points, epsilon) {
  if (points.length < 3) return points
  const [a, b] = [points[0], points[points.length - 1]]
  let maxD = 0
  let idx = 0
  for (let i = 1; i < points.length - 1; i++) {
    const [px, py] = points[i]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const d = Math.abs(dy * px - dx * py + b[0] * a[1] - b[1] * a[0]) / len
    if (d > maxD) {
      maxD = d
      idx = i
    }
  }
  if (maxD <= epsilon) return [a, b]
  return [...simplify(points.slice(0, idx + 1), epsilon).slice(0, -1), ...simplify(points.slice(idx), epsilon)]
}

/**
 * Closed rings start and end on the same point, which makes Douglas–Peucker's baseline
 * degenerate (every distance would be zero). Split at the vertex farthest from the start
 * and simplify the two open halves instead.
 */
function simplifyRing(ring, epsilon) {
  if (ring.length < 5) return ring
  const start = ring[0]
  let far = 1
  let farD = -1
  for (let i = 1; i < ring.length - 1; i++) {
    const d = Math.hypot(ring[i][0] - start[0], ring[i][1] - start[1])
    if (d > farD) {
      farD = d
      far = i
    }
  }
  const a = simplify(ring.slice(0, far + 1), epsilon)
  const b = simplify(ring.slice(far), epsilon)
  return [...a.slice(0, -1), ...b]
}

const r1 = (n) => Math.round(n * 10) / 10

function ringArea(ring) {
  let a = 0
  for (let i = 0; i < ring.length - 1; i++) a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
  return a / 2
}
function ringCentroid(ring) {
  let cx = 0, cy = 0, a = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const f = ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
    cx += (ring[i][0] + ring[i + 1][0]) * f
    cy += (ring[i][1] + ring[i + 1][1]) * f
    a += f
  }
  a /= 2
  return [cx / (6 * a), cy / (6 * a)]
}

let pointsIn = 0
let pointsOut = 0
const wards = features
  .map((f) => {
    const ward = Number(f.properties.WARD)
    let d = ''
    let biggest = null
    for (const poly of polys(f.geometry)) {
      poly.forEach((ring, ri) => {
        const projected = ring.map(project)
        pointsIn += projected.length
        const s = simplifyRing(projected, tol)
        pointsOut += s.length
        d += 'M' + s.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L') + 'Z'
        if (ri === 0 && (!biggest || Math.abs(ringArea(projected)) > Math.abs(ringArea(biggest)))) biggest = projected
      })
    }
    const [cx, cy] = ringCentroid(biggest)
    return { ward, d, label: [r1(cx), r1(cy)] }
  })
  .sort((a, b) => a.ward - b.ward)

const out = {
  source: {
    name: 'Ward Boundaries, City of Mississauga Open Data',
    item: 'https://www.arcgis.com/home/item.html?id=f1cad02b3a40422dac2ea99b59cc36a5',
    terms: 'https://smartcity.mississauga.ca/wp-content/uploads/2021/04/CityofMississauga_TermsofUse.pdf',
    simplification_m: TOLERANCE_M,
  },
  width: WIDTH,
  height: HEIGHT,
  metres_per_unit: Math.round(metresPerUnit * 100) / 100,
  wards,
}
writeFileSync(outPath, JSON.stringify(out) + '\n')
console.log(`wards: ${wards.map((w) => w.ward).join(', ')}`)
console.log(`viewBox 0 0 ${WIDTH} ${HEIGHT} · ${out.metres_per_unit} m per unit · points ${pointsIn} -> ${pointsOut} (tolerance ${TOLERANCE_M} m)`)
console.log(`output ${Math.round(JSON.stringify(out).length / 1024)} KB`)
