/** Accent hue used for light, rims and the leader line (never for data). */
export const ICE = '176 228 255'

/**
 * Sequential ramp for the choropleth: dark slate → ice → near-white. Stops are spaced so
 * lightness rises roughly linearly, and the input is linear in share (0 → highest ward),
 * so equal steps in brightness mean equal differences in share.
 */
const STOPS: [number, [number, number, number]][] = [
  [0, [20, 32, 44]],
  [0.25, [30, 72, 108]],
  [0.5, [46, 126, 172]],
  [0.75, [122, 190, 224]],
  [1, [234, 248, 255]],
]
export function rampColor(t: number) {
  const x = Math.min(1, Math.max(0, t))
  const i = Math.min(STOPS.length - 2, Math.floor(x * (STOPS.length - 1)))
  const [t0, a] = STOPS[i]
  const [t1, b] = STOPS[i + 1]
  const f = (x - t0) / (t1 - t0)
  const c = a.map((v, k) => Math.round(v + (b[k] - v) * f))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}
export const RAMP_CSS = `linear-gradient(90deg, ${STOPS.map(([t]) => `${rampColor(t)} ${t * 100}%`).join(', ')})`
/** Fill for wards whose zero is unconfirmed: the ramp's floor, hatched. */
export const BASE = rampColor(0)

/** Map margin in viewBox units, around the shapes, for depth, lift and labels. */
export const PAD = 40
