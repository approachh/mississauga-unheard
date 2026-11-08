import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import {
  countOf,
  detectedName,
  examplesFor,
  ratioText,
  topWrongGuess,
  unitOf,
  verdictOf,
  type LanguagePair,
} from '../../lib/compare'
import { diffWords, type DiffToken } from '../../lib/diff'
import type { LanguageResult, TranscriptionResult } from '../../types/data'
import { BigRate } from './BigRate'

/** Wrong cells in the 100-square grids. Brighter than the paper-page red so it reads on the dark stage. */
const WRONG = 'bg-[#e5483b] shadow-[0_0_10px_rgb(229_72_59/0.5)]'

/**
 * The centrepiece: pick a language, see the same recordings heard two ways. The headline says
 * what happened for that language (it can be "no real difference"); the grids show it; one real
 * recording shows what it looked like.
 */
export function Compare({ pairs, clips }: { pairs: LanguagePair[]; clips: TranscriptionResult[] }) {
  const [code, setCode] = useState(pairs[0]?.code)
  const pair = pairs.find((p) => p.code === code) ?? pairs[0]
  const wrongGuess = useMemo(() => (pair ? topWrongGuess(pair, clips) : null), [pair, clips])
  if (!pair) return null

  return (
    <div>
      <div role="group" aria-label="Choose a language" className="flex flex-wrap justify-center gap-1.5">
        {pairs.map((p) => {
          const on = p.code === pair.code
          return (
            <button
              key={p.code}
              type="button"
              aria-pressed={on}
              onClick={() => setCode(p.code)}
              className={`inline-flex h-11 items-center rounded-full px-5 text-[15px] font-medium transition-[background-color,color,box-shadow] duration-200 ${
                on ? 'bg-paper text-ink shadow-[0_0_28px_rgb(176_228_255/0.4)]' : 'text-white/60 hover:bg-white/[0.08] hover:text-paper'
              }`}
            >
              {p.language}
            </button>
          )
        })}
      </div>

      <Headline pair={pair} />

      <div className="mt-8 grid gap-5 sm:mt-9 md:grid-cols-2 md:gap-6">
        <Panel
          title="AI guesses the language"
          hint="Like a phone line that just starts listening."
          row={pair.auto}
          pair={pair}
          wrongGuess={wrongGuess}
        />
        <Panel title="AI is told the language" hint="Like choosing it from a menu first." row={pair.forced} pair={pair} wrongGuess={null} />
      </div>

      <ExampleCard key={`${pair.code}-${clips.length}`} pair={pair} clips={clips} />

      <p className="mx-auto mt-10 max-w-[60ch] text-center text-[13px] leading-relaxed text-white/40">
        Real results: {pair.clips} recordings of {pair.language} read aloud (FLEURS), transcribed by ElevenLabs Scribe. Lower is better.
      </p>
    </div>
  )
}

/** One sentence for the selected language. It says "no real difference" when that is the finding. */
function Headline({ pair }: { pair: LanguagePair }) {
  const v = verdictOf(pair)
  return (
    <div key={pair.code} className="swap-in mx-auto mt-8 text-center sm:mt-9" aria-live="polite">
      <p className="text-[12px] font-medium tracking-[0.14em] text-[rgb(176_228_255/0.8)] uppercase">{pair.language}</p>
      <p className="display-m mx-auto mt-3 max-w-[24ch]">
        {v.kind === 'much' && (
          <>
            Told the language, AI makes <Em>{ratioText(v.ratio)} fewer</Em> mistakes.
          </>
        )}
        {v.kind === 'some' && (
          <>
            Told the language, AI makes <Em>{Math.round(v.fewer * 100)}% fewer</Em> mistakes.
          </>
        )}
        {v.kind === 'same' && (
          <>
            Telling AI the language <Em>changes almost nothing</Em> here.
          </>
        )}
        {v.kind === 'worse' && (
          <>
            Told the language, AI makes <Em>more</Em> mistakes.
          </>
        )}
      </p>
    </div>
  )
}

const Em = ({ children }: { children: ReactNode }) => <span className="text-[rgb(176_228_255)]">{children}</span>

function Panel({
  title,
  hint,
  row,
  pair,
  wrongGuess,
}: {
  title: string
  hint: string
  row: LanguageResult
  pair: LanguagePair
  wrongGuess: string | null
}) {
  const unit = unitOf(pair.code)
  const value = row.cer * 100
  const wrongCells = Math.min(100, Math.round(value))
  const langN = countOf(row.pct_language_mismatch, pair.clips)
  const scriptN = countOf(row.pct_script_mismatch, pair.clips)

  const problems: string[] = []
  if (langN > 0) problems.push(`AI named the wrong language in ${langN} of ${pair.clips} recordings${wrongGuess ? ` (it heard ${wrongGuess})` : ''}`)
  if (scriptN > 0) problems.push(`Wrong writing system in ${scriptN} of ${pair.clips} recordings`)

  return (
    <section
      aria-label={title}
      className="rounded-[32px] bg-[rgb(14_19_26/0.72)] p-7 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10 backdrop-blur-xl sm:p-8"
    >
      <h3 className="text-[19px] font-semibold tracking-[-0.01em]">{title}</h3>
      <p className="mt-1 text-[14px] text-white/45">{hint}</p>

      <p className="mt-6 leading-none font-semibold tracking-[-0.05em] tabular-nums">
        <BigRate value={value} />
      </p>
      <p className="mt-3 text-[15px] text-white/60">
        {unit} wrong out of every 100
      </p>

      <UnitGrid wrong={wrongCells} label={`${wrongCells} of 100 squares marked wrong`} />

      <ul className="mt-8 min-h-[3.5rem] space-y-2 text-[14px] leading-snug">
        {problems.length ? (
          problems.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-white/80">
              <span aria-hidden className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#e5483b]" />
              {p}
            </li>
          ))
        ) : (
          <li className="flex items-start gap-2.5 text-white/70">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(176_228_255)]" aria-hidden />
            Right language and writing system in all {pair.clips} recordings
          </li>
        )}
      </ul>
    </section>
  )
}

/** 100 squares; the wrong ones light up in a quick cascade whenever the language changes. */
function UnitGrid({ wrong, label }: { wrong: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="mt-8 grid max-w-[340px] grid-cols-10 gap-[5px] sm:gap-[6px]">
      {Array.from({ length: 100 }, (_, i) => (
        <span
          key={i}
          className={`aspect-square rounded-[3px] transition-[background-color,box-shadow] duration-500 ${i < wrong ? WRONG : 'bg-white/[0.09]'}`}
          style={{ transitionDelay: `${i * 6}ms` }}
        />
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ */
/* One real recording, heard both ways                                 */
/* ------------------------------------------------------------------ */

function ExampleCard({ pair, clips }: { pair: LanguagePair; clips: TranscriptionResult[] }) {
  const ex = useMemo(() => examplesFor(pair, clips), [pair, clips])
  const [i, setI] = useState(ex.start)
  const n = ex.list.length
  const cur = ex.list[Math.min(i, Math.max(0, n - 1))]
  const t = ex.tally
  if (!clips.length) return null

  return (
    <div className="mt-6 rounded-[32px] bg-paper p-6 text-ink sm:p-10 md:mt-8">
      {cur ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <p className="text-[19px] font-semibold tracking-[-0.01em]">The same recording, heard both ways</p>
              <span className={`rounded-full px-3 py-1 text-[12.5px] font-medium ${cur.wrongLanguage ? 'bg-proof-soft text-proof-ink' : 'bg-wash text-ink-2'}`}>
                {cur.wrongLanguage ? `AI thought it was ${detectedName(cur.auto.detected_language)}` : 'The two ways wrote different text'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[14px] text-ink-3">
              <span className="mr-2 tabular-nums">
                {Math.min(i, n - 1) + 1} of {n}
              </span>
              <StepButton label="Previous recording" onClick={() => setI((i - 1 + n) % n)}>
                <ArrowLeft className="h-4 w-4" aria-hidden />
              </StepButton>
              <StepButton label="Next recording" onClick={() => setI((i + 1) % n)}>
                <ArrowRight className="h-4 w-4" aria-hidden />
              </StepButton>
            </div>
          </div>

          <div key={cur.id} className="swap-in mt-8">
            <Line label="What was said">
              <p dir="auto" className="text-[20px] leading-[1.7] sm:text-[22px]">
                {cur.auto.char_level ? cur.auto.reference.replace(/ /g, '') : cur.auto.reference}
              </p>
            </Line>
            <Line label="AI guessing the language" badge={<Badge cer={cur.auto.cer} />}>
              <Heard row={cur.auto} />
            </Line>
            <Line label="AI told the language" badge={<Badge cer={cur.forced.cer} />}>
              <Heard row={cur.forced} />
            </Line>
          </div>
        </>
      ) : (
        <p className="text-[17px] text-ink-2">Both ways wrote exactly the same text for every {pair.language} recording.</p>
      )}

      <p className="mt-8 border-t border-rule pt-5 text-[14px] leading-relaxed text-ink-3">
        {n > 0 && (
          <>
            Different text in {n} of {t.paired} recordings.{' '}
          </>
        )}
        Compared recording by recording, AI made fewer mistakes when told the language in <strong className="font-semibold text-ink">{t.fewer}</strong>, more in{' '}
        <strong className="font-semibold text-ink">{t.more}</strong>, and the same number in <strong className="font-semibold text-ink">{t.same}</strong>.
      </p>
    </div>
  )
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="grid h-10 w-10 place-items-center rounded-full ring-1 ring-rule-2 transition-colors hover:text-ink hover:ring-ink">
      {children}
    </button>
  )
}

function Line({ label, badge, children }: { label: string; badge?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-rule py-5 first:border-0 first:pt-0 last:pb-0 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-8">
      <div className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-ink-3 sm:flex-col sm:items-start sm:gap-1.5 sm:pt-2">
        {label}
        {badge}
      </div>
      {children}
    </div>
  )
}

/** Per-recording result: how much of this one recording was wrong. */
function Badge({ cer }: { cer: number | undefined }) {
  const p = Math.min(100, Math.round((cer ?? 0) * 100))
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium tabular-nums ${p === 0 ? 'bg-wash text-ink-2' : 'bg-proof-soft text-proof-ink'}`}>
      {p === 0 ? 'Perfect' : `${p}% wrong`}
    </span>
  )
}

/** What AI wrote, with the differences from what was said marked. */
function Heard({ row }: { row: TranscriptionResult }) {
  const tokens: DiffToken[] = useMemo(() => diffWords(row.reference, row.hypothesis), [row])
  const sep = row.char_level ? '' : ' '
  if (!tokens.length) return <p className="text-[20px] text-ink-3">(nothing)</p>
  return (
    <p dir="auto" className="text-[20px] leading-[1.7] sm:text-[22px]">
      {tokens.map((t, k) => {
        if (t.hyp === undefined) return <span key={k} className="mark-gap" role="img" aria-label={`missing: ${t.ref}`} />
        const cls = t.kind === 'replaced' ? 'mark-sub' : t.kind === 'extra' ? 'mark-ins' : ''
        return (
          <span key={k}>
            <span className={cls}>{t.hyp}</span>
            {sep}
          </span>
        )
      })}
    </p>
  )
}
