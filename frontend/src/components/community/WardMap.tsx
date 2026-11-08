import { useId, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import type { WardShapes } from '../../types/data'
import { BASE, ICE, PAD, RAMP_CSS, rampColor } from '../../lib/wardRamp'

const DEPTH = 16
const LIFT = 14

/** What the map shows for one ward. */
export interface MapDatum {
  ward: number
  /** Position on the colour ramp, 0–1 (linear in the measure shown). */
  t: number
  /** Short value printed under the ward number. */
  label: string
  /** Hover tag text. */
  tag: string
  /** Full description for screen readers. */
  aria: string
  /** Hatched instead of coloured: the value is unconfirmed. */
  hatched?: boolean
}

interface WardMapProps {
  shapes: WardShapes
  data: MapDatum[]
  /** What the shading means, for the map's accessible name. */
  description: string
  selected: number | null
  onSelect: (ward: number) => void
  /** Floating overlays positioned over the map's empty corners. */
  children?: ReactNode
}

/**
 * Mississauga's 11 wards from the City's official boundaries, rendered as a lit slab and shaded
 * by one measure per ward (a language's share of residents, or the Unheard Index).
 * Orthographic and north-up: the depth cues sit around the map, never distort its plan.
 */
export function WardMap({ shapes, data, description, selected, onSelect, children }: WardMapProps) {
  const uid = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const byWard = new Map(data.map((p) => [p.ward, p]))
  const t = (p?: MapDatum) => (!p || p.hatched ? 0 : p.t)
  const fill = (p?: MapDatum) => (p?.hatched ? `url(#hatch-${uid})` : rampColor(t(p)))

  const vbW = shapes.width + PAD * 2
  const vbH = shapes.height + PAD * 2
  const sel = shapes.wards.find((w) => w.ward === selected)
  const hov = hover !== null && hover !== selected ? shapes.wards.find((w) => w.ward === hover) : undefined
  const hovPoint = hov ? byWard.get(hov.ward) : undefined

  const onKey = (e: KeyboardEvent, ward: number) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(ward)
    }
  }
  // Touch has no hover: a tap selects, and a sticky hover tag would linger.
  const enter = (e: PointerEvent, ward: number) => e.pointerType === 'mouse' && setHover(ward)

  return (
    <div className="relative">
      <svg
        viewBox={`${-PAD} ${-PAD} ${vbW} ${vbH}`}
        className="relative block h-auto w-full overflow-visible"
        role="group"
        aria-label={`Map of Mississauga's 11 wards, shaded by ${description}`}
      >
        <defs>
          <pattern id={`hatch-${uid}`} width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="12" height="12" fill={BASE} />
            <line x1="0" y1="0" x2="0" y2="12" stroke="rgb(255 255 255 / 0.32)" strokeWidth="3" />
          </pattern>
          <radialGradient id={`pool-${uid}`} cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor={`rgb(${ICE})`} stopOpacity="0.16" />
            <stop offset="60%" stopColor={`rgb(${ICE})`} stopOpacity="0.04" />
            <stop offset="100%" stopColor={`rgb(${ICE})`} stopOpacity="0" />
          </radialGradient>
          <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.75" />
            <stop offset="45%" stopColor={`rgb(${ICE})`} stopOpacity="0.35" />
            <stop offset="100%" stopColor={`rgb(${ICE})`} stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id={`sheen-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#fff" stopOpacity="0" />
            <stop offset="50%" stopColor="#fff" stopOpacity="0.13" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`city-${uid}`}>
            {shapes.wards.map((w) => (
              <path key={w.ward} d={w.d} />
            ))}
          </clipPath>
          <filter id={`soft-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="22" />
          </filter>
          <filter id={`glow-${uid}`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="8" />
          </filter>
        </defs>

        {/* Light pool on the "table" and the slab's ground shadow */}
        <ellipse aria-hidden cx={shapes.width / 2} cy={shapes.height * 0.56} rx={shapes.width * 0.78} ry={shapes.height * 0.52} fill={`url(#pool-${uid})`} />
        <g aria-hidden transform={`translate(10 ${DEPTH + 26})`} filter={`url(#soft-${uid})`} opacity="0.85">
          {shapes.wards.map((w) => (
            <path key={w.ward} d={w.d} fill="#000" />
          ))}
        </g>

        {/* Slab thickness: the plan extruded straight down, with a faint lit lower edge */}
        {[DEPTH, DEPTH * 0.75, DEPTH * 0.5, DEPTH * 0.25].map((dy, k) => (
          <g key={dy} aria-hidden transform={`translate(0 ${dy})`}>
            {shapes.wards.map((w) => (
              <path
                key={w.ward}
                d={w.d}
                fill="#0b141e"
                stroke={k === 0 ? `rgb(${ICE} / 0.2)` : '#0b141e'}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            ))}
          </g>
        ))}

        {/* Rim light: drawn under the tops, so only the city's outer edge shows it */}
        <g aria-hidden>
          {shapes.wards.map((w) => (
            <path key={w.ward} d={w.d} fill="none" stroke={`url(#rim-${uid})`} strokeWidth="5" strokeLinejoin="round" />
          ))}
        </g>

        {/* Ward tops, separated by cut gaps */}
        {shapes.wards.map((w, i) => {
          const p = byWard.get(w.ward)
          const isSel = selected === w.ward
          return (
            <path
              key={w.ward}
              data-ward={w.ward}
              d={w.d}
              className="map-ward map-fill-in"
              style={{ ['--i' as string]: i }}
              fill={fill(p)}
              stroke="#06090d"
              strokeWidth="3"
              strokeLinejoin="round"
              tabIndex={0}
              role="button"
              aria-pressed={isSel}
              aria-label={p ? `Ward ${w.ward}: ${p.aria}` : `Ward ${w.ward}`}
              onClick={() => onSelect(w.ward)}
              onKeyDown={(e) => onKey(e, w.ward)}
              onPointerEnter={(e) => enter(e, w.ward)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(w.ward)}
              onBlur={() => setHover(null)}
            />
          )
        })}

        {/* A slow light sweep across the surface, clipped to the city */}
        <g aria-hidden clipPath={`url(#city-${uid})`} className="pointer-events-none">
          <rect className="map-sheen" x={-700} y={-PAD} width="420" height={vbH} fill={`url(#sheen-${uid})`} transform="skewX(-18)" />
        </g>

        {/* Outlines trace in once on arrival */}
        <g aria-hidden className="pointer-events-none">
          {shapes.wards.map((w, i) => (
            <path key={w.ward} d={w.d} pathLength={1} className="map-trace" fill="none" stroke={`rgb(${ICE} / 0.9)`} strokeWidth="1.5" style={{ ['--i' as string]: i }} />
          ))}
        </g>

        {/* Hovered ward: a quiet outline */}
        {hov && <path aria-hidden d={hov.d} className="pointer-events-none" fill="none" stroke="rgb(255 255 255 / 0.85)" strokeWidth="2.5" strokeLinejoin="round" />}

        {/* Selected ward: lifted out of its socket, glowing from beneath */}
        {sel && (
          <g key={sel.ward} aria-hidden className="pointer-events-none">
            <path d={sel.d} fill="#05080c" stroke="#05080c" strokeWidth="3" strokeLinejoin="round" />
            <g className="ward-lift" style={{ ['--lift' as string]: `${-LIFT}px` }}>
              <path d={sel.d} fill="none" stroke={`rgb(${ICE})`} strokeWidth="14" opacity="0.55" filter={`url(#glow-${uid})`} />
              <path d={sel.d} fill={fill(byWard.get(sel.ward))} stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" />
            </g>
          </g>
        )}

        {/* Leader from the selected ward to the floating ward card (wide screens only) */}
        {sel && (
          <g key={`lead-${sel.ward}`} aria-hidden className="map-leader pointer-events-none max-lg:hidden">
            <line x1={sel.label[0] + 56} y1={sel.label[1] - LIFT - 10} x2={shapes.width + PAD} y2={sel.label[1] - LIFT - 10} stroke="rgb(5 8 12 / 0.55)" strokeWidth="5" strokeLinecap="round" />
            <line x1={sel.label[0] + 56} y1={sel.label[1] - LIFT - 10} x2={shapes.width + PAD} y2={sel.label[1] - LIFT - 10} stroke={`rgb(${ICE} / 0.85)`} strokeWidth="1.5" strokeDasharray="3 6" strokeLinecap="round" />
            <circle cx={sel.label[0] + 56} cy={sel.label[1] - LIFT - 10} r="6" fill={`rgb(${ICE})`} stroke="#05080c" strokeWidth="2.5" />
          </g>
        )}

        {/* Labels */}
        {shapes.wards.map((w) => {
          const p = byWard.get(w.ward)
          const dark = !p?.hatched && t(p) > 0.62
          const isSel = selected === w.ward
          return (
            <g key={w.ward} aria-hidden className="pointer-events-none">
              <g className={isSel ? 'ward-lift' : undefined} style={isSel ? { ['--lift' as string]: `${-LIFT}px` } : undefined}>
                <g transform={`translate(${w.label[0]} ${w.label[1]})`}>
                  <text textAnchor="middle" y="-2" className="map-num" fontWeight={700} fill={dark ? '#0b0b0c' : 'rgb(255 255 255 / 0.94)'}>
                    {w.ward}
                  </text>
                  {p && (
                    <text textAnchor="middle" y="24" className="map-sub" fontWeight={500} fill={dark ? 'rgb(11 11 12 / 0.7)' : 'rgb(255 255 255 / 0.62)'}>
                      {p.label}
                    </text>
                  )}
                </g>
              </g>
            </g>
          )
        })}

        {/* Hover tag */}
        {hov && hovPoint && (
          <g aria-hidden className="pointer-events-none" transform={`translate(${hov.label[0]} ${hov.label[1] - 66})`}>
            <rect x="-120" y="-25" width="240" height="38" rx="19" fill="rgb(8 11 15 / 0.88)" stroke={`rgb(${ICE} / 0.35)`} />
            <text textAnchor="middle" y="0" className="map-tag" fill="#fff">
              {hovPoint.tag}
            </text>
          </g>
        )}

        {/* North arrow and 5 km scale, in the empty south-east corner */}
        <g aria-hidden fill="rgb(255 255 255 / 0.5)">
          <g transform={`translate(${shapes.width - 12} ${shapes.height - 150})`}>
            <path d="M0 -10 L8 12 L0 7 L-8 12 Z" />
            <text y="34" textAnchor="middle" className="map-tag">N</text>
          </g>
          <g transform={`translate(${shapes.width - 5000 / shapes.metres_per_unit} ${shapes.height - 40})`}>
            <line x1="0" x2={5000 / shapes.metres_per_unit} y1="0" y2="0" stroke="rgb(255 255 255 / 0.5)" strokeWidth="2" />
            <line x1="0" x2="0" y1="-6" y2="6" stroke="rgb(255 255 255 / 0.5)" strokeWidth="2" />
            <line x1={5000 / shapes.metres_per_unit} x2={5000 / shapes.metres_per_unit} y1="-6" y2="6" stroke="rgb(255 255 255 / 0.5)" strokeWidth="2" />
            <text x={5000 / shapes.metres_per_unit} y="34" textAnchor="end" className="map-tag">5 km</text>
          </g>
        </g>
      </svg>
      {children}
    </div>
  )
}

/** Legend for the ramp; the hatch key appears only when a hatched ward is on the map. */
export function MapLegend({ title, min, max, hatched = false }: { title: string; min: string; max: string; hatched?: boolean }) {
  return (
    <div className="text-[12px] leading-snug text-white/55">
      <p className="mb-2 text-white/70">{title}</p>
      <div className="flex items-center gap-2.5">
        <span className="tabular-nums">{min}</span>
        <span className="h-1.5 min-w-0 flex-1 rounded-full" style={{ background: RAMP_CSS }} aria-hidden />
        <span className="tabular-nums">{max}</span>
      </div>
      {hatched && (
        <p className="mt-2 inline-flex items-center gap-2">
          <span
            aria-hidden
            className="h-3 w-3 rounded-[2px] ring-1 ring-white/30"
            style={{ background: `repeating-linear-gradient(45deg, rgb(255 255 255 / 0.35) 0 2px, ${BASE} 2px 6px)` }}
          />
          Reported zero, unconfirmed
        </p>
      )}
    </div>
  )
}
