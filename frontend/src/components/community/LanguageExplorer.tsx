import { Check, Minus } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { isCaution, shareOfWard, topLanguagesInWard, wardSeries, type CensusModel, type WardPoint } from '../../lib/census'
import { int, pct } from '../../lib/format'
import { langKey } from '../../lib/language'
import type { CitywideLanguage } from '../../types/data'
import { Flag } from '../Flag'
import { AnimatedNumber } from './AnimatedNumber'

const ROW = 44 // px, picker row height; the selection indicator moves in these steps

interface ExplorerProps {
  model: CensusModel
  selected: CitywideLanguage
  onSelect: (l: CitywideLanguage) => void
}

export function LanguageExplorer({ model, selected, onSelect }: ExplorerProps) {
  const key = langKey(selected.language)
  const series = useMemo(() => wardSeries(model, selected.language), [model, selected.language])
  const largest = series.length ? series.reduce((a, b) => (b.speakers > a.speakers ? b : a)) : null

  // The selected ward follows the language: it resets to the largest ward on each change.
  const [ward, setWard] = useState<number | null>(largest?.ward ?? null)
  const [prevKey, setPrevKey] = useState(key)
  if (prevKey !== key) {
    setPrevKey(key)
    setWard(largest?.ward ?? null)
  }
  const point = series.find((p) => p.ward === ward) ?? null

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-14 gap-y-8 lg:grid-cols-[250px_minmax(0,1fr)]">
      <Picker model={model} selected={selected} onSelect={onSelect} />
      <div className="min-w-0 space-y-14">
      <LanguageStory key={key} model={model} lang={selected} largest={largest} />

      <section aria-labelledby="where-h">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
          <h3 id="where-h" className="text-[1.25rem] font-semibold tracking-[-0.015em]">
            Where {selected.language} speakers live
          </h3>
          {series.length > 0 && <p className="text-[14px] text-ink-3">Circle size shows home speakers. Select a ward.</p>}
        </div>
        {series.length ? (
          <>
            <WardBubbles series={series} selected={ward} onSelect={setWard} />
            {point && <WardPanel key={`${key}-${point.ward}`} model={model} lang={selected} point={point} />}
          </>
        ) : (
          <p className="max-w-[60ch] rounded-md border border-dashed border-rule-2 bg-wash px-4 py-3 text-ink-2">
            The ward profile does not include {selected.language}, so where its speakers live is unknown. That is not the
            same as zero.
          </p>
        )}
      </section>
      </div>
    </div>
  )
}

function Picker({ model, selected, onSelect }: { model: CensusModel; selected: CitywideLanguage; onSelect: (l: CitywideLanguage) => void }) {
  const index = model.ranking.findIndex((r) => r.language === selected.language)
  const max = model.ranking[0]?.home_speakers ?? 1
  const chipRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const chipRowRef = useRef<HTMLDivElement>(null)

  // Keep the selected chip in view on small screens.
  useEffect(() => {
    // Scroll only the chip row sideways; scrollIntoView would also scroll the page vertically.
    const chip = chipRefs.current.get(selected.language)
    const row = chipRowRef.current
    if (chip && row) row.scrollTo({ left: chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2, behavior: 'smooth' })
  }, [selected.language])

  return (
    <nav aria-label="Choose a language">
      {/* Small screens: scrollable chips */}
      <div ref={chipRowRef} className="relative -mx-5 flex snap-x gap-1.5 overflow-x-auto px-5 pb-1 lg:hidden">
        {model.ranking.map((r) => {
          const on = r.language === selected.language
          return (
            <button
              key={r.language}
              ref={(el) => {
                if (el) chipRefs.current.set(r.language, el)
              }}
              type="button"
              aria-pressed={on}
              onClick={() => onSelect(r)}
              className={`h-9 shrink-0 snap-center rounded-full border px-3.5 text-[14px] font-medium transition-colors duration-150 ${
                on ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink-2'
              }`}
            >
              {r.language}
            </button>
          )
        })}
      </div>

      {/* Large screens: ranked list with a sliding selection indicator */}
      <div className="hidden lg:block">
        <p className="mb-2 flex justify-between border-b border-ink pb-2 text-[13px] text-ink-3">
          <span>Home language</span>
          <span>People</span>
        </p>
        <ul className="relative">
          <li aria-hidden className="select-indicator pointer-events-none absolute inset-x-0 top-0 rounded-md bg-paper shadow-[0_1px_2px_rgb(0_0_0/0.06)]" style={{ height: ROW, transform: `translateY(${index * ROW}px)` }} />
          {model.ranking.map((r) => {
            const on = r.language === selected.language
            return (
              <li key={r.language} className="relative">
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => onSelect(r)}
                  style={{ height: ROW }}
                  className="group grid w-full grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-2 text-left text-[14px]"
                >
                  <span className="text-[12px] text-ink-3">{r.rank}</span>
                  <span className="min-w-0">
                    <span className={`block truncate transition-colors ${on ? 'font-semibold text-ink' : 'text-ink-2 group-hover:text-ink'}`}>{r.language}</span>
                    <span className="mt-1 block h-[3px] rounded-full bg-rule" aria-hidden>
                      <span
                        className={`block h-full rounded-full transition-colors ${on ? 'bg-ink' : 'bg-rule-2 group-hover:bg-ink-3'}`}
                        style={{ width: `${(r.home_speakers / max) * 100}%` }}
                      />
                    </span>
                  </span>
                  <span className={`text-right tabular-nums ${on ? 'font-semibold text-ink' : 'text-ink-3'}`}>{int(r.home_speakers)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </nav>
  )
}

function LanguageStory({ model, lang, largest }: { model: CensusModel; lang: CitywideLanguage; largest: WardPoint | null }) {
  const coverage = model.coverageBy.get(langKey(lang.language))
  const speech = model.speechBy.get(langKey(lang.language))

  return (
    <article className="swap-in" aria-live="polite">
      <div className="flex items-baseline justify-between gap-6 border-b border-rule pb-3">
        <h3 className="text-[2.25rem] leading-tight font-semibold tracking-[-0.03em]">{lang.language}</h3>
        <p className="shrink-0 text-[14px] text-ink-3">
          Rank {lang.rank} of {model.ranking.length}
        </p>
      </div>

      <p className="mt-6 text-[3.5rem] leading-none font-semibold tracking-[-0.035em] sm:text-[4.5rem]">
        <AnimatedNumber value={lang.home_speakers} />
      </p>
      <p className="mt-2 text-[17px] text-ink-2">people speak {lang.language} at home in Mississauga.</p>

      <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed">
        {largest && largest.speakers > 0 ? (
          <>
            The largest community is in <strong className="font-semibold">Ward {largest.ward}</strong>: {int(largest.speakers)} people, about{' '}
            {pct(largest.share)} of the ward’s residents.
          </>
        ) : (
          <span className="text-ink-2">Ward-level counts are not available for {lang.language}.</span>
        )}
      </p>

      <dl className="mt-10 grid gap-x-12 gap-y-8 border-t border-rule pt-6 md:grid-cols-2">
        <div>
          <dt className="text-[14px] font-semibold">Speech-AI test recordings</dt>
          <dd className="mt-3">
            {coverage ? (
              <>
                <ul className="grid grid-cols-2 gap-x-4 gap-y-2 text-[14px]">
                  <Covered label="Read speech" has={coverage.fleurs_clips > 0} />
                  <Covered label="Accented English" has={coverage.accent_archive_speakers > 0} />
                  <Covered label="Banking calls" has={coverage.minds14_calls > 0} />
                  <Covered label="Assistant commands" has={coverage.speech_massive_commands > 0} />
                </ul>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                  {coverage.has_service_request_audio
                    ? `Service-style requests in ${lang.language} can be tested.`
                    : `No service-request recordings in the datasets we reviewed, so we can’t test everyday requests in ${lang.language} with them.`}
                </p>
              </>
            ) : (
              <p className="text-[14px] text-ink-2">{lang.language} was not part of the dataset check, so its coverage is unknown.</p>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-[14px] font-semibold">Recognition accuracy</dt>
          <dd className="mt-3 text-[14px] leading-relaxed text-ink-2">
            {speech ? (
              <>
                <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.02em] text-ink">
                  {speech.wer !== null ? pct(speech.wer) : pct(speech.cer)}
                </span>{' '}
                of {speech.wer !== null ? 'words' : 'characters'} transcribed wrongly in {int(speech.clips_tested)} read-speech
                test clips, language detected automatically. A small sample: indicative, not definitive. It describes
                words, not how many residents are affected.
              </>
            ) : (
              <>
                <span className="font-medium text-ink">Not measured yet.</span> Results appear here when the speech analysis
                is published.
              </>
            )}
          </dd>
        </div>
      </dl>
    </article>
  )
}

function Covered({ label, has }: { label: string; has: boolean }) {
  return (
    <li className={`flex items-center gap-2 ${has ? 'text-ink' : 'text-ink-3'}`}>
      {has ? <Check className="h-4 w-4 shrink-0" aria-hidden /> : <Minus className="h-4 w-4 shrink-0" aria-hidden />}
      {label}
      <span className="sr-only">{has ? ': available' : ': none'}</span>
    </li>
  )
}

function WardBubbles({ series, selected, onSelect }: { series: WardPoint[]; selected: number | null; onSelect: (w: number) => void }) {
  const max = Math.max(1, ...series.map((p) => p.speakers))
  const top = new Set([...series].sort((a, b) => b.speakers - a.speakers).slice(0, 3).filter((p) => p.speakers > 0).map((p) => p.ward))

  return (
    <div role="radiogroup" aria-label="Wards" className="grid grid-cols-4 gap-x-2 gap-y-6 sm:grid-cols-6 lg:grid-cols-11">
      {series.map((p) => {
        // Area is proportional to speakers.
        const scale = p.speakers > 0 ? Math.max(0.06, Math.sqrt(p.speakers / max)) : 0
        const on = selected === p.ward
        return (
          <button
            key={p.ward}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onSelect(p.ward)}
            aria-label={`Ward ${p.ward}: ${int(p.speakers)} home speakers${p.caution ? ', zero may be a data gap' : ''}`}
            className="group flex flex-col items-center rounded-md pt-1 pb-2"
          >
            <svg viewBox="0 0 100 100" className="aspect-square w-full max-w-[96px]" aria-hidden>
              <circle cx="50" cy="50" r="48" fill="none" stroke={on ? 'var(--color-ink)' : 'transparent'} strokeWidth="1.5" strokeDasharray="3 3" className="transition-[stroke] duration-200" />
              {p.caution ? (
                <circle cx="50" cy="50" r="9" fill="none" stroke="var(--color-ink-3)" strokeDasharray="3 2" />
              ) : (
                <circle
                  cx="50"
                  cy="50"
                  r="44"
                  className="bubble"
                  style={{ transform: `scale(${scale})` }}
                  fill={on || top.has(p.ward) ? 'var(--color-ink)' : 'var(--color-rule-2)'}
                />
              )}
            </svg>
            <span className={`mt-1 text-[13px] ${on ? 'font-semibold text-ink' : 'text-ink-3 group-hover:text-ink'}`}>Ward {p.ward}</span>
            <span className={`text-[13px] tabular-nums ${on ? 'text-ink' : 'text-ink-2'}`}>
              {int(p.speakers)}
              {p.caution && <Flag kind="E" />}
            </span>
          </button>
        )
      })}
    </div>
  )
}

function WardPanel({ model, lang, point }: { model: CensusModel; lang: CitywideLanguage; point: WardPoint }) {
  const ward = model.wards.find((w) => w.ward === point.ward)!
  const top = topLanguagesInWard(ward, 3)
  const gapNames = model.uncovered.map((r) => model.wardName.get(langKey(r.language))).filter((n): n is string => !!n)
  const gapSum = gapNames.reduce((n, name) => n + (ward.home_speakers[name] ?? 0), 0)
  const gapZero = gapNames.some((name) => isCaution(ward.ward, ward.home_speakers[name] ?? 0))

  return (
    <div className="swap-in mt-8 grid gap-x-12 gap-y-8 border-t border-ink pt-6 md:grid-cols-3">
      <Block title={`Ward ${point.ward}`} note={point.corrected ? 'Figures corrected by the census team in November 2026.' : undefined}>
        {point.caution ? (
          <p className="text-ink-2">
            Reported as <strong className="text-ink">0</strong> {lang.language} speakers
            <Flag kind="E" />. This may be a gap in the source data rather than no speakers.
          </p>
        ) : (
          <>
            <p className="text-[2rem] leading-none font-semibold tracking-[-0.02em]">
              <AnimatedNumber value={point.speakers} />
            </p>
            <p className="mt-1.5 text-ink-2">
              speak {lang.language} at home, {pct(point.share)} of the ward’s residents.
            </p>
          </>
        )}
      </Block>
      <Block title="Most spoken here">
        <ol className="space-y-1.5">
          {top.map((t) => (
            <li key={t.language} className="flex items-baseline justify-between gap-3">
              <span className={t.language === model.wardName.get(langKey(lang.language)) ? 'font-semibold' : ''}>{t.language}</span>
              <span className="text-ink-2 tabular-nums">
                {int(t.speakers)} <span className="text-[12px] text-ink-3">{pct(t.share)}</span>
              </span>
            </li>
          ))}
        </ol>
      </Block>
      <Block title="Testing gap in this ward">
        <p className="text-ink-2">
          <strong className="font-semibold text-ink">{int(gapSum)}</strong>
          {gapZero && <Flag kind="E" />} home-speaker counts here belong to the {gapNames.length} languages without
          service-request recordings: at most {pct(shareOfWard(gapSum, ward))} of residents, since someone who speaks
          several of them is counted more than once.
        </p>
      </Block>
    </div>
  )
}

function Block({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <div className="text-[15px] leading-relaxed">
      <h4 className="mb-2 font-semibold">{title}</h4>
      {children}
      {note && <p className="mt-2 text-[13px] text-ink-3">{note}</p>}
    </div>
  )
}
