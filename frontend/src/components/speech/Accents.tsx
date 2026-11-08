import { useMemo, useState, type ReactNode } from 'react'
import { useInViewOnce } from '../../hooks/useInViewOnce'
import { diffWords } from '../../lib/diff'
import { pct } from '../../lib/format'
import type { AccentGroup, AccentResults } from '../../types/data'
import { Chapter } from '../story/Story'
import { BigRate } from './BigRate'

/** The strip plot runs 0–15% of words wrong; a speaker beyond that sits at the edge and is labelled with the real value. */
const AXIS_MAX = 0.15
const TICKS = [0, 0.05, 0.1, 0.15]
const at = (v: number) => `${(Math.min(v, AXIS_MAX) / AXIS_MAX) * 100}%`
const SLIDE = 'transition-[left,width,background-color] duration-[900ms] ease-[cubic-bezier(0.16,1,0.3,1)]'
const ROW_GRID = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[9.5rem_minmax(0,1fr)_6.5rem]'
const AXIS_GRID = 'grid-cols-1 sm:grid-cols-[9.5rem_minmax(0,1fr)_6.5rem]'
const ICE = 'rgb(176 228 255)'

/** Hesitations and cut-off words the AI wrote down as spoken ("uh", "um", "st--"). They count as errors because the paragraph has none. */
const hesitations = (text: string) => (text.match(/\b(?:uh|um|er|ah)\b|\b\w+--/gi) ?? []).length

const nameOf = (g: AccentGroup, native: AccentGroup) => (g === native ? 'Native English' : g.language)

/**
 * "Even in English, accents matter": the same English paragraph read by native speakers and by
 * speakers from twelve language backgrounds. First the headline contrast, then every speaker as
 * a dot, so a group's average is never mistaken for every person in it.
 */
export function AccentSection({ data }: { data: AccentResults }) {
  const { native, groups, accented, passage, english_recognised: rec } = data
  const rows = useMemo(() => [native, ...groups], [native, groups])
  const [selected, setSelected] = useState(groups[0].language)
  const group = rows.find((g) => g.language === selected) ?? groups[0]

  return (
    <Chapter tone="ink" size="l" label="Accents" className="voice-atmosphere overflow-hidden">
      <h2 className="reveal display-m max-w-[16ch]">Even in English, accents matter.</h2>
      <p className="lede mt-6 max-w-[50ch] text-white/60">
        Everyone read the same {passage.words}-word paragraph aloud.{' '}
        {rec.correct === rec.total ? 'AI recognised it as English every time.' : `AI recognised it as English in ${rec.correct} of ${rec.total} recordings.`} What changed was the
        accent.
      </p>

      <div className="mt-16 grid gap-5 sm:mt-20 md:grid-cols-2 md:gap-6">
        <Figure label="Native English speakers" note={`${native.speakers} people`} value={native.wer} />
        <Figure label="Speakers with an accent" note={`${accented.speakers} people from ${accented.groups} language backgrounds`} value={accented.wer} />
      </div>

      <Spread rows={rows} native={native} selected={group.language} onSelect={setSelected} />
      <GroupCard key={group.language} g={group} native={native} passage={passage.text} />

      <p className="mt-12 max-w-[62ch] text-[13px] leading-relaxed text-white/40">
        Ten people per group, one paragraph. A group is people who share a native language, not a whole community, and one speaker can move an average a long way. That is why
        each person is shown. Hesitations and repeated words the AI wrote down as spoken count as errors too.
      </p>
    </Chapter>
  )
}

/** One headline number. The bar uses a 0–10% scale so the two can be compared by eye. */
function Figure({ label, note, value }: { label: string; note: string; value: number }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>(0.4)
  return (
    <section
      aria-label={label}
      className="rounded-[32px] bg-[rgb(14_19_26/0.72)] p-7 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10 backdrop-blur-xl sm:p-8"
    >
      <h3 className="text-[19px] font-semibold tracking-[-0.01em]">{label}</h3>
      <p className="mt-1 text-[14px] text-white/45">{note}</p>
      <p className="mt-6 leading-none font-semibold tracking-[-0.05em] tabular-nums">
        <BigRate value={value * 100} />
      </p>
      <p className="mt-3 text-[15px] text-white/60">words wrong out of every 100</p>
      <div ref={ref} className="mt-8">
        <div aria-hidden className="h-1.5 rounded-full bg-white/[0.09]">
          <span
            className="block h-full rounded-full bg-[rgb(176_228_255)] transition-[width] duration-[1100ms] ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: seen ? `${Math.min(100, (value / 0.1) * 100)}%` : '0%' }}
          />
        </div>
        <div aria-hidden className="mt-2 flex justify-between text-[12px] text-white/35">
          <span>0</span>
          <span>10</span>
        </div>
      </div>
    </section>
  )
}

/** A deterministic vertical offset so speakers with nearly the same score stay visible side by side. */
function laneOffsets(values: number[]) {
  return values.map((v, i) => {
    let lane = 0
    for (let j = i - 1; j >= 0 && v - values[j] < 0.0045; j--) lane++
    return ((lane % 4) - 1.5) * 9
  })
}

function Spread({ rows, native, selected, onSelect }: { rows: AccentGroup[]; native: AccentGroup; selected: string; onSelect: (language: string) => void }) {
  const [ref, seen] = useInViewOnce<HTMLUListElement>(0.2)
  const nativeMax = native.highest_wer

  return (
    <div className="mt-24 sm:mt-32">
      <h3 className="text-[1.75rem] font-semibold tracking-[-0.02em]">One dot is one speaker.</h3>
      <p className="mt-3 max-w-[54ch] text-[15px] leading-relaxed text-white/55">
        Each group is ten people. The blue line is the group’s average; the dots show how different the people in it are. Select a group to read what the AI wrote.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-2 text-[13px] text-white/55">
        <span className="inline-flex items-center gap-2.5">
          <span aria-hidden className="h-[10px] w-[10px] rounded-full bg-white/70" /> one speaker
        </span>
        <span className="inline-flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-[3px] rounded-full" style={{ background: ICE }} /> group average
        </span>
        <span className="inline-flex items-center gap-2.5">
          <span aria-hidden className="h-4 w-6 rounded-sm bg-[rgb(176_228_255/0.12)]" /> range of native English speakers
        </span>
      </div>

      {/* Axis */}
      <div aria-hidden className={`mt-8 grid gap-x-6 px-3 ${AXIS_GRID}`}>
        <span className="hidden sm:block" />
        <div className="relative mx-[8px] h-5">
          {TICKS.map((t) => (
            <span key={t} className="absolute -translate-x-1/2 text-[12px] text-white/35 tabular-nums" style={{ left: at(t) }}>
              {pct(t, 0)}
              {t === AXIS_MAX ? '+' : ''}
            </span>
          ))}
        </div>
        <span className="hidden sm:block" />
      </div>

      <ul ref={ref} className="mt-1">
        {rows.map((g, r) => {
          const on = g.language === selected
          const offsets = laneOffsets(g.speaker_wer)
          const isNative = g === native
          return (
            <li key={g.language} className={`border-t border-white/10 ${isNative ? 'mb-3 border-b' : ''}`}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(g.language)}
                className={`grid w-full items-center gap-x-6 rounded-xl px-3 py-1 text-left transition-colors duration-300 ${ROW_GRID} ${on ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'}`}
              >
                <span className={`order-1 text-[16px] font-medium ${isNative ? 'text-[rgb(176_228_255)]' : ''}`}>{nameOf(g, native)}</span>
                <span className="order-2 text-right text-[14px] text-white/55 tabular-nums sm:order-3">
                  average <span className="font-semibold text-paper">{pct(g.wer)}</span>
                </span>
                <span
                  role="img"
                  aria-label={`${nameOf(g, native)}: average ${pct(g.wer)} of words wrong. Individual speakers from ${pct(g.speaker_wer[0])} to ${pct(g.highest_wer)}.`}
                  className="relative order-3 col-span-2 mx-[8px] h-14 sm:order-2 sm:col-span-1"
                >
                  <span aria-hidden className="absolute inset-x-[-8px] top-1/2 h-px bg-white/10" />
                  <span aria-hidden className="absolute inset-y-1 left-0 rounded-sm bg-[rgb(176_228_255/0.10)]" style={{ width: at(nativeMax) }} />
                  {g.speaker_wer.map((w, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={`${SLIDE} absolute h-[10px] w-[10px] -translate-x-1/2 -translate-y-1/2 rounded-full ${w > AXIS_MAX ? 'ring-2 ring-[rgb(176_228_255)]' : ''} ${on ? 'bg-white' : 'bg-white/55'}`}
                      style={{ left: seen ? at(w) : '0%', top: `calc(50% + ${offsets[i]}px)`, transitionDelay: `${r * 55 + i * 14}ms` }}
                    />
                  ))}
                  {g.speaker_wer
                    .filter((w) => w > AXIS_MAX)
                    .map((w, i) => (
                      <span key={`o${i}`} aria-hidden className="absolute top-0 right-0 text-[11px] text-[rgb(176_228_255)] tabular-nums">
                        {pct(w, 0)}
                      </span>
                    ))}
                  <span
                    aria-hidden
                    className={`${SLIDE} absolute top-1/2 h-8 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full`}
                    style={{ left: seen ? at(g.wer) : '0%', background: ICE, transitionDelay: `${r * 55 + 160}ms` }}
                  />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** What the AI wrote for one group: numbers first, then a real recording. */
function GroupCard({ g, native, passage }: { g: AccentGroup; native: AccentGroup; passage: string }) {
  const [which, setWhich] = useState<'typical' | 'highest'>('typical')
  const ex = g[which]
  const under5 = g.speaker_wer.filter((w) => w < 0.05).length
  const outlier = g.wer_without_highest !== null && g.wer - g.wer_without_highest > 0.25 * g.wer
  const isNative = g === native
  const stumbles = hesitations(ex.heard)

  return (
    <div className="swap-in mt-6 rounded-[32px] bg-paper p-6 text-ink sm:p-10 md:mt-8">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h3 className="text-[1.5rem] font-semibold tracking-[-0.02em]">{isNative ? 'Native English speakers' : `${g.language} speakers`}</h3>
        <p className="text-[14px] text-ink-3">{g.speakers} people, each reading the same paragraph</p>
      </div>

      <dl className="mt-8 grid grid-cols-3 gap-x-4 gap-y-4 sm:gap-x-10">
        <Stat label="Average" value={pct(g.wer)} />
        <Stat label="Middle speaker" value={pct(g.median_wer)} />
        <Stat label="Highest speaker" value={pct(g.highest_wer)} />
      </dl>
      <p className="mt-6 max-w-[62ch] text-[15px] leading-relaxed text-ink-2">
        {under5} of {g.speakers} speakers had fewer than 5 in every 100 words wrong.
        {outlier && g.wer_without_highest !== null && <> Without the single highest speaker, the average would be {pct(g.wer_without_highest)}.</>}
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-3 border-t border-rule pt-8">
        <p className="mr-2 basis-full text-[15px] font-semibold sm:basis-auto">What the AI wrote for</p>
        <div role="radiogroup" aria-label="Which speaker" className="inline-flex rounded-full bg-wash p-1">
          {(['typical', 'highest'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={which === k}
              onClick={() => setWhich(k)}
              className={`h-9 rounded-full px-3.5 text-[14px] font-medium whitespace-nowrap transition-colors duration-200 sm:px-4 ${which === k ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
            >
              {k === 'typical' ? 'Middle speaker' : 'Highest speaker'}
            </button>
          ))}
        </div>
        <span className={`rounded-full px-3 py-1 text-[12.5px] font-medium tabular-nums ${ex.wer === 0 ? 'bg-wash text-ink-2' : 'bg-proof-soft text-proof-ink'}`}>
          {ex.wer === 0 ? 'Perfect' : `${pct(ex.wer)} of words wrong`}
        </span>
      </div>

      <div key={which} className="swap-in mt-6">
        <Line label="What was said">
          <p className="text-[17px] leading-[1.75] sm:text-[19px]">{passage}</p>
        </Line>
        <Line label="What AI heard">
          <Heard reference={passage} text={ex.heard} />
          {stumbles >= 3 && (
            <p className="mt-4 max-w-[58ch] text-[13px] leading-relaxed text-ink-3 sm:col-start-1">
              Part of the difference here is hesitations and cut-off words (“uh”, “st--”) that the speaker said and the AI wrote down as spoken. The paragraph has none.
            </p>
          )}
        </Line>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-1.5 text-[13px] text-ink-3 sm:text-[14px]">{label}</dt>
      <dd className="text-[clamp(1.75rem,4.5vw,3rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums">{value}</dd>
    </div>
  )
}

function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-t border-rule py-5 first:border-0 first:pt-0 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-8">
      <p className="text-[13px] font-medium text-ink-3 sm:pt-1.5">{label}</p>
      {children}
    </div>
  )
}

/** What AI wrote, with the differences from what was said marked. */
function Heard({ reference, text }: { reference: string; text: string }) {
  const tokens = useMemo(() => diffWords(reference, text), [reference, text])
  if (!tokens.length) return <p className="text-[19px] text-ink-3">(nothing)</p>
  return (
    <p className="text-[17px] leading-[1.75] sm:text-[19px]">
      {tokens.map((t, k) => {
        if (t.hyp === undefined) return <span key={k} className="mark-gap" role="img" aria-label={`missing: ${t.ref}`} />
        const cls = t.kind === 'replaced' ? 'mark-sub' : t.kind === 'extra' ? 'mark-ins' : ''
        return (
          <span key={k}>
            <span className={cls}>{t.hyp}</span>{' '}
          </span>
        )
      })}
    </p>
  )
}

/** Methodology for "Go deeper": how the test works, every group's numbers, and its limits. */
export function AccentDetails({ data }: { data: AccentResults }) {
  const { native, groups, passage, source, english_recognised: rec } = data
  const rows = [native, ...groups]
  return (
    <div className="text-[15px] leading-relaxed text-ink-2">
      <div className="max-w-[62ch] space-y-3">
        <p>
          The recordings come from the{' '}
          <a href={source.url} target="_blank" rel="noopener noreferrer" className="underline">
            {source.dataset}
          </a>{' '}
          (George Mason University). Every speaker reads the same {passage.words}-word English paragraph. Groups are speakers who share a native language; native English
          speakers are the baseline. Recordings are not republished here, and nothing about the speakers is.
        </p>
        <p>
          Each recording was sent once to {source.model.replace(', language detected automatically', '')} with the language left for it to detect, and the text was compared with the
          paragraph. Word error rate (WER) is wrong, missed and extra words out of the words in the paragraph. The AI named English in {rec.correct} of {rec.total} recordings.
        </p>
        <p>
          Limits: ten speakers per group is small, so one person can move an average (the strip plot shows each one). Hesitations, repeated words and cut-off words that a speaker
          really said count as errors, and they account for much of the highest individual scores. The paragraph is short and includes names such as Stella and Bob. It is read
          speech, not conversation. The 95% ranges come from resampling the ten speakers.
        </p>
      </div>
      <div className="mt-8 overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-[13px]">
          <caption className="mb-3 text-left text-[13px] text-ink-3">Words wrong, by speakers’ native language</caption>
          <thead className="text-[12px] text-ink-3">
            <tr className="border-b border-rule-2">
              <th className="py-2 font-normal">Group</th>
              <th className="py-2 text-right font-normal">Speakers</th>
              <th className="py-2 text-right font-normal">Average (95% range)</th>
              <th className="py-2 text-right font-normal">Middle</th>
              <th className="py-2 text-right font-normal">Highest</th>
              <th className="py-2 text-right font-normal">Letters wrong</th>
            </tr>
          </thead>
          <tbody className="tabular-nums">
            {rows.map((g) => (
              <tr key={g.language} className="border-b border-rule">
                <td className="py-2 text-ink">{nameOf(g, native)}</td>
                <td className="py-2 text-right">{g.speakers}</td>
                <td className="py-2 text-right">
                  {pct(g.wer)}
                  {g.wer_ci && <span className="text-ink-3"> ({pct(g.wer_ci[0])}–{pct(g.wer_ci[1])})</span>}
                </td>
                <td className="py-2 text-right">{pct(g.median_wer)}</td>
                <td className="py-2 text-right">{pct(g.highest_wer)}</td>
                <td className="py-2 text-right">{pct(g.cer)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
