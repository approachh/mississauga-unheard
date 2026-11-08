import { ChevronDown } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isCaution, shareOfWard, topLanguagesInWard, wardSeries, type CensusModel, type OfficialModel, type WardPoint } from '../../lib/census'
import { int, pct } from '../../lib/format'
import { langKey } from '../../lib/language'
import { PAD, rampColor } from '../../lib/wardRamp'
import type { CitywideLanguage, RecognitionMode, UnheardIndex, UnheardWard, WardShapes } from '../../types/data'
import { Flag } from '../Flag'
import { AnimatedNumber } from './AnimatedNumber'
import { MapLegend, WardMap, type MapDatum } from './WardMap'

export type MapView = 'index' | 'language' | 'official'

interface MapExplorerProps {
  model: CensusModel
  shapes: WardShapes | null
  index: UnheardIndex | null
  official: OfficialModel | null
  view: MapView
  selected: CitywideLanguage
  onSelect: (l: CitywideLanguage) => void
  onIndex: () => void
  onOfficial: () => void
}

const MODE_LABEL: Record<RecognitionMode, string> = { auto: 'Auto-detect', forced: 'Language given' }

/**
 * The Community page's centrepiece: the real ward map, showing either the Unheard Index or where
 * one language's speakers live. On wide screens the city figures float in the map's empty corners
 * and the ward card hangs off a leader line from the selected ward.
 */
export function MapExplorer({ model, shapes, index, official, view, selected, onSelect, onIndex, onOfficial }: MapExplorerProps) {
  const isOfficial = view === 'official' && official !== null
  const isIndex = !isOfficial && view === 'index' && index !== null
  const key = isOfficial ? 'official' : isIndex ? 'index' : langKey(selected.language)
  const series = useMemo(() => wardSeries(model, selected.language), [model, selected.language])
  const [mode, setMode] = useState<RecognitionMode>('auto')
  // Experimental: weight the index by residents with no English or French.
  const [weighted, setWeighted] = useState(false)

  const defaultWard = () => {
    if (isOfficial) return official.topShare.ward
    if (isIndex) return index.wards.find((w) => pickScore(w, weighted).rank.auto === 1)?.ward ?? null
    return series.length ? series.reduce((a, b) => (b.share > a.share ? b : a)).ward : null
  }
  // The selected ward resets to the top ward whenever the view or language changes.
  const [ward, setWard] = useState<number | null>(defaultWard)
  const [prevKey, setPrevKey] = useState(key)
  if (prevKey !== key) {
    setPrevKey(key)
    setWard(defaultWard())
  }

  const data: MapDatum[] = isOfficial ? officialData(official) : isIndex ? indexData(index, mode, weighted) : languageData(series, selected.language)
  const shape = shapes?.wards.find((w) => w.ward === ward)
  const anchor = shapes && shape ? (shape.label[1] - 24 + PAD) / (shapes.height + PAD * 2) : 0.5
  const { columnRef, cardRef, cardTop, stubTop } = useFloatingCard(anchor, !!shapes && data.length > 0)

  const figures = isOfficial ? (
    <OfficialSummary official={official} />
  ) : isIndex ? (
    <IndexSummary index={index} mode={mode} onMode={setMode} weighted={weighted} onWeighted={setWeighted} />
  ) : (
    <CityFigures model={model} index={index} lang={selected} />
  )

  return (
    <div>
      <ViewChips
        model={model}
        index={index}
        official={official}
        view={isOfficial ? 'official' : isIndex ? 'index' : 'language'}
        selected={selected}
        onSelect={onSelect}
        onIndex={onIndex}
        onOfficial={onOfficial}
      />

      {shapes && data.length ? (
        <div className="mt-8 grid grid-cols-[minmax(0,1fr)] lg:mt-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* Mobile: figures sit above the map */}
          <div className="mb-6 lg:hidden">{figures}</div>

          <div className="map-stage reveal-scale -mx-5 sm:mx-0">
            <WardMap
              shapes={shapes}
              data={data}
              description={
                isOfficial
                  ? 'share of residents who cannot hold a conversation in English or French'
                  : isIndex
                    ? `the ${weighted ? 'experimental weighted ' : ''}Unheard Index (${MODE_LABEL[mode].toLowerCase()})`
                    : `share of residents who speak ${selected.language} at home`
              }
              selected={ward}
              onSelect={setWard}
            >
              <div className="absolute top-[2%] left-0 hidden w-[36%] lg:block">{figures}</div>
              <div className="absolute bottom-[1%] left-0 hidden w-[38%] lg:block">
                <Legend isIndex={isIndex} isOfficial={isOfficial} official={official} weighted={weighted} series={series} language={selected.language} mode={mode} />
              </div>
            </WardMap>
          </div>

          <div className="mt-6 lg:hidden">
            <Legend isIndex={isIndex} isOfficial={isOfficial} official={official} weighted={weighted} series={series} language={selected.language} mode={mode} />
          </div>

          {/* Ward card: floats beside the map on wide screens, follows it below otherwise */}
          <div ref={columnRef} className="relative mt-8 lg:mt-0">
            <span aria-hidden className="card-glide absolute left-0 hidden h-px w-8 -translate-y-1/2 bg-[rgb(176_228_255/0.55)] lg:block" style={{ top: stubTop }} />
            <div ref={cardRef} className="card-glide lg:absolute lg:right-0 lg:left-8 lg:-translate-y-1/2" style={{ top: cardTop }}>
              {ward !== null &&
                (isOfficial ? (
                  <OfficialCard official={official} model={model} ward={ward} onSelect={setWard} />
                ) : isIndex ? (
                  <IndexCard index={index} ward={ward} mode={mode} weighted={weighted} onSelect={setWard} />
                ) : (
                  <WardCard model={model} official={official} lang={selected} series={series} ward={ward} onSelect={setWard} />
                ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          {figures}
          <p className="self-start rounded-2xl p-6 text-white/60 ring-1 ring-white/12">
            {!shapes
              ? 'The ward map could not be loaded.'
              : `The ward profile does not include ${selected.language}, so where its speakers live is unknown, not zero.`}
          </p>
        </div>
      )}

      {isIndex && <IndexMethod index={index} />}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Map data                                                            */
/* ------------------------------------------------------------------ */

function languageData(series: WardPoint[], language: string): MapDatum[] {
  const max = Math.max(0.0001, ...series.map((p) => p.share))
  return series.map((p) => ({
    ward: p.ward,
    t: p.share / max,
    label: p.caution ? '0?' : pct(p.share),
    tag: p.caution ? 'Unconfirmed zero' : `${int(p.speakers)} speakers`,
    aria: p.caution ? 'reported as zero, unconfirmed' : `${int(p.speakers)} ${language} speakers, ${pct(p.share)} of residents`,
    hatched: p.caution,
  }))
}

type Score = Pick<UnheardWard, 'index' | 'index_ci' | 'rank' | 'rank_range'>
/** The primary Unheard Index, or the experimental weighted one. Both are on the same 0-100 scale. */
const pickScore = (w: UnheardWard, weighted: boolean): Score => (weighted ? w.weighted : w)

/** Both modes share one scale (100 = top ward, auto-detect), so switching mode recolours honestly. */
function indexData(index: UnheardIndex, mode: RecognitionMode, weighted: boolean): MapDatum[] {
  const name = weighted ? 'Weighted index (experimental)' : 'Unheard Index'
  return index.wards.map((w) => {
    const s = pickScore(w, weighted)
    return {
      ward: w.ward,
      t: Math.min(1, s.index[mode] / 100),
      label: Math.round(s.index[mode]).toString(),
      tag: `${weighted ? 'Weighted ' : 'Index '}${Math.round(s.index[mode])} · rank ${s.rank[mode]}`,
      aria: `${name} ${Math.round(s.index[mode])}, rank ${s.rank[mode]} of 11`,
    }
  })
}

/** Share of each ward's residents with no English or French. Linear ramp from 0 to the highest ward. */
function officialData(official: OfficialModel): MapDatum[] {
  const max = Math.max(0.0001, ...official.wards.map((w) => w.share))
  return official.wards.map((w) => ({
    ward: w.ward,
    t: w.share / max,
    label: pct(w.share),
    tag: `${int(w.knows_neither)} residents`,
    aria: `${int(w.knows_neither)} residents with no English or French, ${pct(w.share)} of the ward, ${ordinal(official.rankByShare.get(w.ward) ?? 0)} highest of 11`,
  }))
}

function Legend({
  isIndex,
  isOfficial,
  official,
  weighted,
  series,
  language,
  mode,
}: {
  isIndex: boolean
  isOfficial: boolean
  official: OfficialModel | null
  weighted: boolean
  series: WardPoint[]
  language: string
  mode: RecognitionMode
}) {
  if (isOfficial && official)
    return <MapLegend title="Share of residents with no English or French" min="0%" max={pct(Math.max(...official.wards.map((w) => w.share)))} />
  if (isIndex)
    return <MapLegend title={`${weighted ? 'Weighted index, experimental' : 'Unheard Index'} · ${MODE_LABEL[mode].toLowerCase()}`} min="0" max="100" />
  const max = Math.max(0.0001, ...series.map((p) => p.share))
  return <MapLegend title={`Share of residents speaking ${language} at home`} min="0%" max={pct(max)} hatched={series.some((p) => p.caution)} />
}

/**
 * Keeps the floating ward card level with the selected ward while keeping it inside the map's
 * height (wide screens). Returns the card's centre and the leader stub's position.
 */
function useFloatingCard(anchor: number, ready: boolean) {
  const columnRef = useRef<HTMLDivElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ column: 0, card: 0 })

  useLayoutEffect(() => {
    const col = columnRef.current
    const card = cardRef.current
    if (!col || !card) return
    const measure = () => setSize({ column: col.offsetHeight, card: card.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(col)
    ro.observe(card)
    return () => ro.disconnect()
  }, [ready])

  const H = size.column
  const h = size.card
  const y = anchor * H
  const centre = H > h ? Math.min(H - h / 2, Math.max(h / 2, y)) : h / 2
  return { columnRef, cardRef, cardTop: H ? `${centre}px` : '50%', stubTop: H ? `${y}px` : '50%' }
}

/* ------------------------------------------------------------------ */
/* Chips                                                               */
/* ------------------------------------------------------------------ */

function ViewChips({
  model,
  index,
  official,
  view,
  selected,
  onSelect,
  onIndex,
  onOfficial,
}: {
  model: CensusModel
  index: UnheardIndex | null
  official: OfficialModel | null
  view: MapView
  selected: CitywideLanguage
  onSelect: (l: CitywideLanguage) => void
  onIndex: () => void
  onOfficial: () => void
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const chipRefs = useRef(new Map<string, HTMLButtonElement>())
  const active = view === 'index' ? '__index' : view === 'official' ? '__official' : selected.language

  // Keep the active chip in view, scrolling the row only (never the page).
  useEffect(() => {
    const chip = chipRefs.current.get(active)
    const row = rowRef.current
    if (chip && row && row.scrollWidth > row.clientWidth) {
      row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' })
    }
  }, [active])

  const chip = (id: string, on: boolean, onClick: () => void, children: ReactNode, extra = '') => (
    <button
      key={id}
      ref={(el) => {
        if (el) chipRefs.current.set(id, el)
      }}
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[14px] font-medium transition-[background-color,color,box-shadow] duration-200 ${
        on ? 'bg-paper text-ink shadow-[0_0_28px_rgb(176_228_255/0.4)]' : 'text-white/60 hover:bg-white/[0.08] hover:text-paper'
      } ${extra}`}
    >
      {children}
    </button>
  )

  return (
    <div>
      <div role="group" aria-label="Choose what the map shows" ref={rowRef} className="chip-row -mx-5 flex gap-1 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {index &&
          chip(
            '__index',
            view === 'index',
            onIndex,
            <>
              <span aria-hidden className={`h-2 w-2 rounded-full ${view === 'index' ? 'bg-ink' : 'bg-[rgb(176_228_255)]'}`} />
              Unheard Index
            </>,
            view === 'index' ? 'mr-1' : 'mr-1 text-paper ring-1 ring-[rgb(176_228_255/0.4)]',
          )}
        {official &&
          chip(
            '__official',
            view === 'official',
            onOfficial,
            <>
              <span aria-hidden className={`h-2 w-2 rounded-full ${view === 'official' ? 'bg-ink' : 'bg-[rgb(176_228_255)]'}`} />
              No English or French
            </>,
            view === 'official' ? 'mr-2' : 'mr-2 text-paper ring-1 ring-[rgb(176_228_255/0.4)]',
          )}
        {model.ranking.map((r) => {
          const missing = model.coverageBy.get(langKey(r.language))?.has_service_request_audio === false
          const on = view === 'language' && r.language === selected.language
          return chip(
            r.language,
            on,
            () => onSelect(r),
            <>
              {missing && <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-ink' : 'bg-white/60'}`} aria-hidden />}
              {r.language}
            </>,
          )
        })}
      </div>
      <p className="mt-3 inline-flex items-center gap-2 text-[12px] text-white/45">
        <span className="h-1.5 w-1.5 rounded-full bg-white/60" aria-hidden />
        No service-request recordings in the datasets we reviewed
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* Index view                                                          */
/* ------------------------------------------------------------------ */

function ModeToggle({ mode, onMode }: { mode: RecognitionMode; onMode: (m: RecognitionMode) => void }) {
  return (
    <div role="radiogroup" aria-label="Recognition mode" className="relative inline-grid grid-cols-2 rounded-full bg-white/[0.06] p-1 ring-1 ring-white/10">
      <span
        aria-hidden
        className="select-indicator absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-paper shadow-[0_0_20px_rgb(176_228_255/0.35)]"
        style={{ transform: mode === 'forced' ? 'translateX(100%)' : 'none' }}
      />
      {(['auto', 'forced'] as const).map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={mode === m}
          onClick={() => onMode(m)}
          className={`relative z-10 h-8 rounded-full px-3 text-[12.5px] font-medium whitespace-nowrap transition-colors duration-300 ${mode === m ? 'text-ink' : 'text-white/65 hover:text-paper'}`}
        >
          {MODE_LABEL[m]}
        </button>
      ))}
    </div>
  )
}

function IndexSummary({
  index,
  mode,
  onMode,
  weighted,
  onWeighted,
}: {
  index: UnheardIndex
  mode: RecognitionMode
  onMode: (m: RecognitionMode) => void
  weighted: boolean
  onWeighted: (v: boolean) => void
}) {
  const avg = (m: RecognitionMode) => index.wards.reduce((n, w) => n + pickScore(w, weighted).index[m], 0) / index.wards.length
  const drop = 1 - avg('forced') / avg('auto')
  return (
    <div className="swap-in">
      <p className="text-[12px] font-medium tracking-[0.12em] text-[rgb(176_228_255/0.75)] uppercase">
        {weighted ? 'Experimental weighted score' : 'Relative priority score'}
      </p>
      <p className="mt-3 max-w-[34ch] text-[15px] leading-snug text-white/80">
        {weighted
          ? 'The same score, multiplied by each ward’s share of residents with no English or French. A ranking, not a count of people misunderstood.'
          : 'Where speech AI makes the most errors in the languages people speak at home, weighted by how many residents speak them.'}
      </p>
      <div className="mt-5">
        <ModeToggle mode={mode} onMode={onMode} />
        <p className="mt-2.5 max-w-[34ch] text-[12.5px] leading-snug text-white/50">
          {mode === 'auto'
            ? 'The system guesses the language, as a phone line would when a caller just starts speaking.'
            : `The system is told the language. Ward scores fall by ${Math.round(drop * 100)}% on average.`}
        </p>
        <label className="mt-4 flex max-w-[34ch] cursor-pointer items-start gap-2.5 text-[12.5px] leading-snug text-white/60">
          <input
            type="checkbox"
            checked={weighted}
            onChange={(e) => onWeighted(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(176_228_255)]"
          />
          <span>
            <span className="font-medium text-white/85">Experimental:</span> weight by residents with no English or French
          </span>
        </label>
      </div>
      <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-white/12 pt-4 text-[12.5px] leading-snug lg:max-w-[88%]">
        <dt className="text-white/45">Scored</dt>
        <dd className="text-white/80">
          {index.languages.length} languages, {pct(index.coverage.tested_share)} of residents
        </dd>
        <dt className="text-white/45">Not scored</dt>
        <dd className="text-white/80">
          {index.untested.length} untested, {pct(index.coverage.untested_share)} of residents
        </dd>
      </dl>
    </div>
  )
}

function IndexCard({
  index,
  ward,
  mode,
  weighted,
  onSelect,
}: {
  index: UnheardIndex
  ward: number
  mode: RecognitionMode
  weighted: boolean
  onSelect: (w: number) => void
}) {
  const full = index.wards.find((x) => x.ward === ward)
  if (!full) return null
  const w = { ...full, ...pickScore(full, weighted) }
  const other: RecognitionMode = mode === 'auto' ? 'forced' : 'auto'
  const [lo, hi] = w.index_ci[mode]
  const [rLo, rHi] = w.rank_range[mode]
  return (
    <article className="rounded-[24px] bg-[rgb(14_19_26/0.72)] p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10 backdrop-blur-xl sm:p-7">
      <div aria-live="polite">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-[12px] font-medium tracking-[0.12em] text-[rgb(176_228_255/0.85)] uppercase">
            Ward {w.ward}
            {weighted && <span className="ml-2 normal-case tracking-normal text-white/50">experimental</span>}
          </h3>
          <span className="text-[12px] text-white/50">
            Rank {w.rank[mode]} of 11{rLo !== rHi ? ` · could be ${rLo}–${rHi}` : ''}
          </span>
        </div>
        <p className="mt-2 flex items-baseline gap-3">
          <span className="text-[2.75rem] leading-none font-semibold tracking-[-0.035em]">
            <AnimatedNumber value={Math.round(w.index[mode])} />
          </span>
          <span className="text-[13px] text-white/45">
            95% range {Math.round(lo)}–{Math.round(hi)}
          </span>
        </p>
        <p className="mt-2 text-[13.5px] leading-snug text-white/60">
          {MODE_LABEL[other]}: <span className="text-white/85 tabular-nums">{Math.round(w.index[other])}</span>
          {mode === 'auto' && w.index.forced < w.index.auto && <> · giving the language removes {Math.round((1 - w.index.forced / w.index.auto) * 100)}% of this score</>}
        </p>

        <p className="mt-4 text-[13px] leading-relaxed text-white/50">
          Driven by{' '}
          {w.drivers[mode].map((d, i) => (
            <span key={d.language}>
              <span className="text-white/85">{d.language}</span> {Math.round(d.share_of_score * 100)}%{i < w.drivers[mode].length - 1 ? ', ' : ''}
            </span>
          ))}
          . Not scored: {pct(w.untested_share)} of residents speak an untested language
          {w.untested_unconfirmed_zero.length > 0 && ' (possibly more: the zeros reported here for ' + w.untested_unconfirmed_zero.join(', ') + ' are unconfirmed)'}.
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-white/50">
          <span className="text-white/85 tabular-nums">{int(w.no_official_count)}</span> residents ({pct(w.no_official_share)}) have no English or French
          {weighted ? ': this share weights the score.' : '.'}
        </p>
      </div>

      <Ranking index={index} ward={ward} mode={mode} weighted={weighted} onSelect={onSelect} />
    </article>
  )
}

const ROW = 26

/** All 11 wards by rank. Rows glide to their new places when the mode changes. */
function Ranking({ index, ward, mode, weighted, onSelect }: { index: UnheardIndex; ward: number; mode: RecognitionMode; weighted: boolean; onSelect: (w: number) => void }) {
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <p className="mb-2 flex justify-between text-[11px] tracking-[0.08em] text-white/40 uppercase">
        <span>Ranking</span>
        <span>
          {weighted ? 'Experimental · ' : ''}
          {MODE_LABEL[mode]}
        </span>
      </p>
      <ol
        className="relative"
        style={{ height: ROW * index.wards.length }}
        aria-label={`Wards ranked by ${weighted ? 'the experimental weighted index' : 'Unheard Index'}, ${MODE_LABEL[mode].toLowerCase()}`}
      >
        {index.wards.map((w) => (
          <RankRow key={w.ward} w={w} mode={mode} weighted={weighted} on={w.ward === ward} onSelect={onSelect} />
        ))}
      </ol>
    </div>
  )
}

function RankRow({ w: ward, mode, weighted, on, onSelect }: { w: UnheardWard; mode: RecognitionMode; weighted: boolean; on: boolean; onSelect: (w: number) => void }) {
  const w = { ward: ward.ward, ...pickScore(ward, weighted) }
  const v = w.index[mode]
  return (
    <li className="rank-row absolute inset-x-0" style={{ height: ROW, transform: `translateY(${(w.rank[mode] - 1) * ROW}px)` }}>
      <button
        type="button"
        aria-pressed={on}
        aria-label={`Rank ${w.rank[mode]}: Ward ${w.ward}, ${weighted ? 'weighted index' : 'index'} ${Math.round(v)}`}
        onClick={() => onSelect(w.ward)}
        className={`grid h-full w-full grid-cols-[1.25rem_3.75rem_minmax(0,1fr)_2rem] items-center gap-2 rounded-md px-1 text-left text-[12.5px] ${on ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'}`}
      >
        <span className="text-white/35 tabular-nums">{w.rank[mode]}</span>
        <span className={on ? 'font-semibold text-paper' : 'text-white/70'}>Ward {w.ward}</span>
        <span className="relative h-1.5 rounded-full bg-white/[0.06]" aria-hidden>
          {/* With the language specified, the auto-detect score stays as a faint ghost for comparison. */}
          {mode === 'forced' && <span className="absolute inset-y-0 left-0 rounded-full bg-white/12" style={{ width: `${Math.min(100, w.index.auto)}%` }} />}
          <span className="bar-w absolute inset-y-0 left-0 rounded-full" style={{ width: `${Math.min(100, v)}%`, background: rampColor(Math.max(0.35, v / 100)) }} />
        </span>
        <span className={`text-right tabular-nums ${on ? 'text-paper' : 'text-white/60'}`}>{Math.round(v)}</span>
      </button>
    </li>
  )
}

function IndexMethod({ index }: { index: UnheardIndex }) {
  const [open, setOpen] = useState(false)
  const commit = index.source.speech.commit?.slice(0, 7)
  const moved = index.wards.filter((w) => w.rank_script_neutral.auto !== w.rank.auto).length
  const topSame = index.wards.filter((w) => w.rank.auto <= 3).every((w) => w.rank_script_neutral.auto <= 3)
  return (
    <section className="mt-14 border-t border-white/10 pt-6 lg:mt-10">
      <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className="flex w-full items-center justify-between gap-6 text-left">
        <span>
          <span className="block text-[17px] font-semibold tracking-[-0.01em]">How the Unheard Index is calculated</span>
          <span className="mt-1 block text-[13.5px] text-white/50">A ranking for deciding where to act first, not a count of people the AI misunderstands.</span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-white/50 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      <div className="disclosure-body" data-open={open}>
        <div>
          <div className="grid gap-x-14 gap-y-8 pt-8 text-[14px] leading-relaxed text-white/65 lg:grid-cols-2">
            <MethodBlock title="Calculation">
              <p>
                For each ward, every tested language adds its share of the ward’s residents multiplied by its character error rate. The ward with the highest auto-detect
                total is set to 100, and every other score, in both modes, is on that same scale.
              </p>
              <p className="mt-3 rounded-lg bg-white/[0.04] px-4 py-3 font-mono text-[12.5px] text-white/80">score = Σ share(ward, language) × CER(language, mode)</p>
            </MethodBlock>
            <MethodBlock title="Why character error rate">
              <p>
                Word error rate does not exist for Mandarin or Cantonese, which are written without spaces. CER works for every language and is applied the same way to all:
                text in the wrong script (Urdu written in Devanagari, Cantonese in Simplified characters) counts as errors.
                {moved > 0 && ` Forgiving Chinese script differences would change ${moved} ward rank${moved > 1 ? 's' : ''}${topSame ? '; the top three stay the same' : ''}.`}
              </p>
            </MethodBlock>
            <MethodBlock title="Uncertainty">
              <p>
                Clips were resampled {int(index.method.bootstrap.resamples)} times within each language; each ward’s range is the middle 95% of the results. Languages tested
                on fewer than {index.method.small_sample_threshold} clips (marked below) are less certain than their range shows.
              </p>
            </MethodBlock>
            <MethodBlock title="Experimental weighted view">
              <p>
                The checkbox multiplies each ward’s score by its share of residents who cannot hold a conversation in English or French (2021 census), then rescales so the highest
                ward is 100. It asks where hard-to-recognise languages overlap with people who have no official language to fall back on.
              </p>
              <p className="mt-3 rounded-lg bg-white/[0.04] px-4 py-3 font-mono text-[12.5px] text-white/80">weighted = score × share with no English or French</p>
              <p className="mt-3">
                It is a relative ranking, not a count of people the AI misunderstands: the share is a ward average, not broken down by language, and counts are rounded to 5.
                Recent immigrants are not used.
              </p>
            </MethodBlock>
            <MethodBlock title="Limits">
              <p>
                Errors come from read-aloud sentences (FLEURS), not real calls to the City. The census records languages spoken at home; the separate count of residents with no
                English or French is a ward total, so the index cannot tell which language each of those residents speaks, and one person can be counted under two languages. {index.untested.length} languages ({index.untested.map((u) => u.language).join(', ')}) have no speech
                results: they are left out of the score, not treated as zero.
              </p>
            </MethodBlock>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-[13px]">
              <caption className="mb-3 text-left text-[13px] text-white/50">Character error rate per tested language</caption>
              <thead className="text-[12px] text-white/45">
                <tr className="border-b border-white/10">
                  <th className="py-2 font-normal">Language</th>
                  <th className="py-2 text-right font-normal">Clips</th>
                  <th className="py-2 text-right font-normal">Auto-detect</th>
                  <th className="py-2 text-right font-normal">Language given</th>
                  <th className="py-2 text-right font-normal">Detected as another language</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {index.languages.map((l) => (
                  <tr key={l.language} className="border-b border-white/[0.06]">
                    <td className="py-2 text-white/85">
                      {l.language}
                      {l.small_sample && <span className="ml-2 text-[11px] text-white/40">small sample</span>}
                    </td>
                    <td className="py-2 text-right text-white/60">{l.clips}</td>
                    <td className="py-2 text-right">{pct(l.cer.auto)}</td>
                    <td className="py-2 text-right">{pct(l.cer.forced)}</td>
                    <td className="py-2 text-right text-white/60">{Math.round(l.pct_language_mismatch.auto)}% of clips</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-[12.5px] leading-relaxed text-white/40">
            Sources: {index.source.speech.dataset}, {int(index.source.speech.clips_used)} clip transcriptions
            {commit ? ` (speech evaluation ${commit})` : ''}; {index.source.census}.
            {index.baseline && ` English baseline: ${pct(index.baseline.cer.auto)} CER on ${index.baseline.clips} clips.`} Rebuild with{' '}
            <code className="font-mono text-white/60">npm run data:index</code>.
          </p>
        </div>
      </div>
    </section>
  )
}

function MethodBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-[14px] font-semibold text-paper">{title}</h4>
      {children}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* No English or French view                                           */
/* ------------------------------------------------------------------ */

/** Citywide figure for the map: residents who cannot hold a conversation in English or French. */
function OfficialSummary({ official }: { official: OfficialModel }) {
  return (
    <div className="swap-in" aria-live="polite">
      <p className="text-[12px] font-medium tracking-[0.12em] text-[rgb(176_228_255/0.75)] uppercase">Citywide · 2021 census</p>
      <p className="mt-2 text-[clamp(2.5rem,4.4vw,3.75rem)] leading-none font-semibold tracking-[-0.04em]">
        <AnimatedNumber value={Math.round(official.total / 100) * 100} />
      </p>
      <p className="mt-2 max-w-[24ch] text-[15px] leading-snug text-white/60">residents can’t hold a conversation in English or French</p>
      <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 border-t border-white/12 pt-4 text-[12.5px] leading-snug lg:max-w-[88%]">
        <dt className="text-white/45">Share</dt>
        <dd className="text-white/80">
          {pct(official.share)} of {int(official.base)} counted for language
        </dd>
        <dt className="text-white/45">Counts</dt>
        <dd className="text-white/80">Rounded to 5 by Statistics Canada; the 11 wards add up to {int(official.total)}</dd>
      </dl>
    </div>
  )
}

function OfficialCard({ official, model, ward, onSelect }: { official: OfficialModel; model: CensusModel; ward: number; onSelect: (w: number) => void }) {
  const w = official.byWard.get(ward)
  if (!w) return null
  const rank = official.rankByShare.get(ward) ?? 0
  const share = (n: number) => pct(n)
  const wardRow = model.wards.find((x) => x.ward === ward)
  const max = Math.max(0.0001, ...official.wards.map((x) => x.share))
  return (
    <article
      className="rounded-[24px] bg-[rgb(14_19_26/0.72)] p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10 backdrop-blur-xl sm:p-7"
      aria-live="polite"
    >
      <div key={ward} className="swap-in">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-[12px] font-medium tracking-[0.12em] text-[rgb(176_228_255/0.85)] uppercase">Ward {w.ward}</h3>
          {wardRow?.corrected && <span className="text-[11px] text-white/40">Ward 10 checked against neighbourhoods</span>}
        </div>
        <p className="mt-2 text-[2.5rem] leading-none font-semibold tracking-[-0.035em]">
          <AnimatedNumber value={w.knows_neither} />
        </p>
        <p className="mt-2 text-[15px] text-white/60">
          {share(w.share)} of {int(w.language_base)} residents · {rank === 1 ? 'highest of 11 wards' : `${ordinal(rank)} of 11 wards`}
        </p>
      </div>

      <div role="group" aria-label="Compare wards" className="mt-6 grid grid-cols-11 gap-1">
        {official.wards.map((x) => {
          const on = x.ward === ward
          return (
            <button
              key={x.ward}
              type="button"
              aria-pressed={on}
              aria-label={`Ward ${x.ward}: ${share(x.share)}, ${int(x.knows_neither)} residents`}
              onClick={() => onSelect(x.ward)}
              className="group flex flex-col items-center gap-1.5 rounded-md pt-1 outline-offset-0"
            >
              <span className="flex h-12 w-full items-end justify-center">
                <span
                  className={`strip-bar block w-full max-w-[18px] rounded-t-[3px] ${on ? 'ring-1 ring-white' : 'opacity-80 group-hover:opacity-100'}`}
                  style={{ height: `${Math.max(4, (x.share / max) * 100)}%`, background: rampColor(x.share / max) }}
                />
              </span>
              <span className={`text-[11px] tabular-nums ${on ? 'font-semibold text-paper' : 'text-white/45 group-hover:text-white/80'}`}>{x.ward}</span>
            </button>
          )
        })}
      </div>

      <p className="mt-5 border-t border-white/10 pt-4 text-[13px] leading-relaxed text-white/50">
        2021 census: residents who cannot conduct a conversation in English or French. The share uses the ward’s language-base population. The census does not say which
        language they speak.
      </p>
    </article>
  )
}

/** One line in the language view's ward card: residents with no English or French here. */
function WardOfficialLine({ official, ward }: { official: OfficialModel | null; ward: number }) {
  const w = official?.byWard.get(ward)
  if (!official || !w) return null
  return (
    <p>
      <span className="text-white/80 tabular-nums">{int(w.knows_neither)}</span> residents ({pct(w.share)}) have no English or French.
    </p>
  )
}

/* ------------------------------------------------------------------ */
/* Language view                                                       */
/* ------------------------------------------------------------------ */

/** Citywide figures for the language: the total and the speech-testing outcome. */
function CityFigures({ model, index, lang }: { model: CensusModel; index: UnheardIndex | null; lang: CitywideLanguage }) {
  const coverage = model.coverageBy.get(langKey(lang.language))
  const tested = index?.languages.find((l) => langKey(l.language) === langKey(lang.language))
  const speech = model.speechBy.get(langKey(lang.language))
  return (
    <div key={lang.language} className="swap-in" aria-live="polite">
      <p className="text-[12px] font-medium tracking-[0.12em] text-[rgb(176_228_255/0.75)] uppercase">
        Citywide · #{lang.rank} of {model.ranking.length}
      </p>
      <p className="mt-2 text-[clamp(2.5rem,4.4vw,3.75rem)] leading-none font-semibold tracking-[-0.04em]">
        <AnimatedNumber value={lang.home_speakers} />
      </p>
      <p className="mt-2 max-w-[22ch] text-[15px] leading-snug text-white/60">people speak {lang.language} at home in Mississauga</p>

      <dl className="mt-6 grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] gap-x-6 gap-y-1 border-t border-white/12 pt-4 lg:max-w-[26ch] lg:grid-cols-1 lg:gap-y-4">
        <div>
          <dt className="text-[12px] text-white/45">AI character errors</dt>
          <dd className="mt-1">
            {tested ? (
              <>
                <span className="text-[1.375rem] leading-none font-semibold tracking-[-0.02em]">{pct(tested.cer.auto)}</span>
                <span className="mt-1 block text-[12px] leading-snug text-white/45">
                  auto-detect · {pct(tested.cer.forced)} with the language given · {tested.clips} clips
                </span>
              </>
            ) : speech ? (
              <>
                <span className="text-[1.375rem] leading-none font-semibold tracking-[-0.02em]">{pct(speech.cer)}</span>
                <span className="mt-1 block text-[12px] leading-snug text-white/45">auto-detect · {speech.clips_tested} clips</span>
              </>
            ) : (
              <span className="text-[14px] text-white/60">Not tested yet</span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] text-white/45">Service-request recordings</dt>
          <dd className="mt-1 text-[14px] leading-snug font-medium">
            {coverage ? (coverage.has_service_request_audio ? 'In reviewed datasets' : 'None in reviewed datasets') : <span className="text-white/60">Not checked</span>}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function WardCard({
  model,
  official,
  lang,
  series,
  ward,
  onSelect,
}: {
  model: CensusModel
  official: OfficialModel | null
  lang: CitywideLanguage
  series: WardPoint[]
  ward: number
  onSelect: (ward: number) => void
}) {
  const wardRow = model.wards.find((w) => w.ward === ward)
  const name = model.wardName.get(langKey(lang.language))
  const point = series.find((p) => p.ward === ward)
  if (!wardRow || !point || !name) return null

  const rankByShare = [...series].sort((a, b) => b.share - a.share).findIndex((p) => p.ward === ward) + 1
  const others = topLanguagesInWard(wardRow, 4)
    .filter((t) => t.language !== name)
    .slice(0, 2)
  const caution = isCaution(wardRow.ward, wardRow.home_speakers[name] ?? 0)

  return (
    <article
      className="rounded-[24px] bg-[rgb(14_19_26/0.72)] p-6 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10 backdrop-blur-xl sm:p-7"
      aria-live="polite"
    >
      <div key={`${lang.language}-${ward}`} className="swap-in">
        <div className="flex items-baseline justify-between gap-4">
          <h3 className="text-[12px] font-medium tracking-[0.12em] text-[rgb(176_228_255/0.85)] uppercase">Ward {wardRow.ward}</h3>
          {wardRow.corrected && <span className="text-[11px] text-white/40">figures corrected by census team</span>}
        </div>

        {caution ? (
          <p className="mt-3 text-[15px] leading-relaxed text-white/70">
            Reported as <strong className="text-paper">0</strong> {lang.language} speakers
            <Flag kind="E" />. Unconfirmed: possibly a gap in the source data.
          </p>
        ) : (
          <>
            <p className="mt-2 text-[2.5rem] leading-none font-semibold tracking-[-0.035em]">
              <AnimatedNumber value={point.speakers} />
            </p>
            <p className="mt-2 text-[15px] text-white/60">
              {pct(point.share)} of residents · {rankByShare === 1 ? 'highest of 11 wards' : `${ordinal(rankByShare)} of 11 wards`}
            </p>
          </>
        )}
      </div>

      <WardStrip series={series} ward={ward} onSelect={onSelect} />

      <div key={`more-${lang.language}-${ward}`} className="swap-in mt-5 space-y-2 border-t border-white/10 pt-4 text-[13px] leading-relaxed text-white/50">
        {others.length > 0 && (
          <p>
            Also spoken here:{' '}
            {others.map((t, i) => (
              <span key={t.language}>
                <span className="text-white/80">{t.language}</span> {int(t.speakers)}
                {i < others.length - 1 ? ' · ' : ''}
              </span>
            ))}
          </p>
        )}
        <WardGapLine model={model} wardRow={wardRow} />
        <WardOfficialLine official={official} ward={ward} />
      </div>
    </article>
  )
}

/** All 11 wards side by side: a comparison at a glance, and large tap targets for picking a ward. */
function WardStrip({ series, ward, onSelect }: { series: WardPoint[]; ward: number; onSelect: (ward: number) => void }) {
  const max = Math.max(0.0001, ...series.map((p) => p.share))
  return (
    <div role="group" aria-label="Compare wards" className="mt-6 grid grid-cols-11 gap-1">
      {series.map((p) => {
        const on = p.ward === ward
        const h = p.caution ? 100 : Math.max(4, (p.share / max) * 100)
        return (
          <button
            key={p.ward}
            type="button"
            aria-pressed={on}
            aria-label={`Ward ${p.ward}: ${p.caution ? 'unconfirmed zero' : pct(p.share)}`}
            onClick={() => onSelect(p.ward)}
            className="group flex flex-col items-center gap-1.5 rounded-md pt-1 outline-offset-0"
          >
            <span className="flex h-12 w-full items-end justify-center">
              <span
                className={`strip-bar block w-full max-w-[18px] rounded-t-[3px] ${on ? 'ring-1 ring-white' : 'opacity-80 group-hover:opacity-100'}`}
                style={{
                  height: `${h}%`,
                  background: p.caution ? 'repeating-linear-gradient(45deg, rgb(255 255 255 / 0.3) 0 2px, transparent 2px 6px)' : rampColor(p.share / max),
                }}
              />
            </span>
            <span className={`text-[11px] tabular-nums ${on ? 'font-semibold text-paper' : 'text-white/45 group-hover:text-white/80'}`}>{p.ward}</span>
          </button>
        )
      })}
    </div>
  )
}

function WardGapLine({ model, wardRow }: { model: CensusModel; wardRow: CensusModel['wards'][number] }) {
  const names = model.uncovered.map((r) => model.wardName.get(langKey(r.language))).filter((n): n is string => !!n)
  const sum = names.reduce((n, name) => n + (wardRow.home_speakers[name] ?? 0), 0)
  if (!names.length) return null
  return (
    <p>
      Up to {pct(shareOfWard(sum, wardRow))} of this ward’s {int(wardRow.population_language_base)} residents speak one of the {names.length} languages without
      service-request recordings ({int(sum)} home-speaker counts; one person can be counted twice).
    </p>
  )
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`
