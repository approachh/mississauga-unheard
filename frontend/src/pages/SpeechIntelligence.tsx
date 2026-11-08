import { Search, X } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DataIssues } from '../components/DataIssues'
import { Disclosure } from '../components/Disclosure'
import { Code, Skeleton } from '../components/EmptyState'
import { ErrorRateChart, type Metric } from '../components/ErrorRateChart'
import { Flag } from '../components/Flag'
import { Notes } from '../components/Notes'
import { Segmented } from '../components/Segmented'
import { AccentDetails, AccentSection } from '../components/speech/Accents'
import { Compare } from '../components/speech/Compare'
import { LanguageGap } from '../components/speech/LanguageGap'
import { Chapter, Container, Words } from '../components/story/Story'
import { DiffLegend, ProofLines } from '../components/TranscriptDiff'
import { useDataset } from '../hooks/useDataset'
import { buildPairs, FULL_TEST_CLIPS, summarySentence } from '../lib/compare'
import { diffWords, summarise } from '../lib/diff'
import type { FlagKind } from '../lib/flags'
import { pct, titleCase } from '../lib/format'
import { inMode, MODE_LABEL, modesOf, PRIMARY_MODE, rate } from '../lib/speech'
import { loadAccentResults, loadLanguageResults, loadTranscriptions } from '../services/dataService'
import type { AccentResults } from '../types/data'

type TranscriptFilter = 'all' | 'errors' | 'exact'
const PREVIEW = 3
/** The dark opening stage is wider than the reading column: the comparison needs the room. */
const STAGE = 'mx-auto w-full max-w-[1100px] px-5 sm:px-8'

export function SpeechIntelligence() {
  const langs = useDataset(loadLanguageResults)
  const trans = useDataset(loadTranscriptions)

  // Accented English is a separate test: its own file, shown only when it loads.
  const [accents, setAccents] = useState<AccentResults | null>(null)
  useEffect(() => {
    let live = true
    loadAccentResults().then((a) => {
      if (live) setAccents(a)
    })
    return () => {
      live = false
    }
  }, [])

  // The detail section below shows one way of asking the AI at a time.
  const [selected, setSelected] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('wer')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TranscriptFilter>('all')
  const [showAll, setShowAll] = useState(false)
  const [mode, setMode] = useState<string>(PRIMARY_MODE)

  const modes = useMemo(() => modesOf(langs.data), [langs.data])
  const L = useMemo(() => inMode(langs.data, modes.length ? mode : null), [langs.data, modes, mode])
  const T = useMemo(() => inMode(trans.data, modes.length ? mode : null), [trans.data, modes, mode])

  // The comparison: languages run both ways. Fully tested ones get the main view; small tests are summarised.
  const pairs = useMemo(() => buildPairs(langs.data), [langs.data])
  const full = pairs.filter((p) => p.clips >= FULL_TEST_CLIPS)
  const small = pairs.filter((p) => p.clips < FULL_TEST_CLIPS)
  const identical = small.filter((p) => Math.abs(p.auto.cer - p.forced.cer) < 0.005)
  const smallClips = [...new Set(small.map((p) => p.clips))]

  // Union of languages from both files so transcript-only languages are still selectable.
  const languages = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of L) m.set(l.language_code, l.language)
    for (const t of T) if (!m.has(t.language_code)) m.set(t.language_code, t.language)
    return [...m].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [L, T])

  const diffs = useMemo(
    () =>
      T.map((t) => {
        const tokens = diffWords(t.reference, t.hypothesis)
        return { t, tokens, s: summarise(tokens) }
      }),
    [T],
  )

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return diffs.filter(({ t, s }) => {
      if (selected && t.language_code !== selected) return false
      if (filter === 'errors' && s.errors === 0) return false
      if (filter === 'exact' && s.errors > 0) return false
      if (!q) return true
      return [t.reference, t.hypothesis, t.id, t.language].some((x) => x.toLowerCase().includes(q))
    })
  }, [diffs, selected, query, filter])

  const toggle = (code: string) => setSelected((s) => (s === code ? null : code))
  const shown = showAll ? visible : visible.slice(0, PREVIEW)

  const flags: FlagKind[] = []
  if (langs.isSample || trans.isSample) flags.push('S')
  if (T.some((t) => t.wer === undefined && !t.char_level)) flags.push('C')

  return (
    <>
      {/* The whole point, in one screen */}
      <section aria-label="Same speech, two results" className="voice-atmosphere relative overflow-hidden bg-ink pt-12 pb-24 text-paper sm:pt-12 sm:pb-36">
        <div className={STAGE}>
          <header className="text-center">
            <p className="text-[12px] font-medium tracking-[0.14em] text-[rgb(176_228_255/0.8)] uppercase">Speech test</p>
            <h1 className="mt-4 text-[clamp(2.5rem,5.6vw,4.25rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
              <Words text="Same voice." />
              <br />
              <Words text="Different result." offset={2} />
            </h1>
            <p className="mx-auto mt-4 max-w-[62ch] text-[clamp(1.0625rem,1.4vw,1.1875rem)] leading-[1.5] text-white/60">Whether AI knows the language can change what it hears. Real recordings, tested both ways.</p>
            {langs.isSample && (
              <p className="mt-6 inline-flex items-center gap-1 rounded-full bg-white/10 px-4 py-1.5 text-[13px] text-white/70">
                Sample data, not real results <Flag kind="S" />
              </p>
            )}
          </header>

          <div className="mt-8 sm:mt-9">
            {langs.status === 'loading' ? (
              <div className="space-y-5">
                <Skeleton className="mx-auto h-12 max-w-md bg-white/10" />
                <div className="grid gap-5 md:grid-cols-2">
                  <Skeleton className="h-96 bg-white/10" />
                  <Skeleton className="h-96 bg-white/10" />
                </div>
              </div>
            ) : full.length ? (
              <Compare pairs={full} clips={trans.data} />
            ) : (
              <p className="mx-auto max-w-[44ch] text-center text-[17px] text-white/60">
                The side-by-side comparison appears here once results are published for both ways of asking the AI.
              </p>
            )}
          </div>
        </div>
      </section>

      <Container className="empty:hidden">
        <DataIssues
          datasets={[
            { label: 'Language results', file: 'language_results.json', ds: langs },
            { label: 'Transcription results', file: 'transcription_results.json', ds: trans },
          ]}
        />
      </Container>

      {/* Not every language changes: the honest overview */}
      {full.length > 1 && (
        <Chapter size="l" label="Language by language">
          <h2 className="reveal display-m max-w-[16ch]">It depends on the language.</h2>
          <p className="lede mt-6 max-w-[48ch] text-ink-2">{summarySentence(full)}</p>
          <div className="reveal mt-16 sm:mt-20">
            <LanguageGap pairs={full} />
          </div>
          {small.length > 0 && (
            <p className="mt-12 max-w-[62ch] text-[15px] leading-relaxed text-ink-3">
              {small.length} more languages ({small.map((p) => p.language).join(', ')}) were tested on {smallClips.join(' or ')} recordings each.{' '}
              {identical.length === small.length
                ? 'Telling the AI the language made no difference in any of them, but that is too few recordings to be sure.'
                : `Telling the AI the language made no difference in ${identical.length} of them. With so few recordings, read these as early signs.`}
            </p>
          )}
        </Chapter>
      )}

      {/* A different question: even when the language is right, does the accent matter? */}
      {accents && <AccentSection data={accents} />}

      {/* Everything else, for anyone who wants it */}
      <Chapter tone="wash" size="l" label="All the data">
        <h2 className="reveal display-m">Go deeper.</h2>
        <p className="lede mt-5 max-w-[44ch] text-ink-2">Every language, every recording, and how it was measured.</p>

        <div className="mt-20 sm:mt-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <h3 className="text-[1.75rem] font-semibold tracking-[-0.02em]">Every language, side by side.</h3>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              {modes.length > 1 && (
                <Segmented
                  label="How the AI was asked"
                  value={mode}
                  onChange={setMode}
                  options={modes.map((m) => ({ value: m, label: MODE_LABEL[m] ?? m }))}
                />
              )}
              <Segmented
                label="Rank by"
                value={metric}
                onChange={setMetric}
                options={[
                  { value: 'wer', label: 'Words' },
                  { value: 'cer', label: 'Characters' },
                ]}
              />
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Focus a language">
            <Chip active={selected === null} onClick={() => setSelected(null)}>
              All
            </Chip>
            {languages.map((l) => (
              <Chip key={l.code} active={selected === l.code} onClick={() => toggle(l.code)}>
                {titleCase(l.name)}
              </Chip>
            ))}
          </div>

          <div className="mt-10">
            {langs.status === 'loading' ? (
              <Skeleton className="h-80" />
            ) : L.length ? (
              <ErrorRateChart data={L} rankBy={metric} selected={selected} onSelect={toggle} />
            ) : (
              <p className="text-ink-2">Results appear here once the analysis is published.</p>
            )}
          </div>
        </div>

        <div className="mt-20 border-t border-ink sm:mt-28">
          <Disclosure title="Every recording" summary={`Search all ${int0(T.length)} transcripts, what was said and what AI heard.`}>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <label className="relative block md:w-80">
                <span className="sr-only">Search transcripts</span>
                <Search className="pointer-events-none absolute top-1/2 left-4 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search words or languages"
                  className="h-11 w-full rounded-full border border-rule-2 bg-paper pr-10 pl-10 text-[15px] transition-colors hover:border-ink-3 focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
                />
                {query && (
                  <button type="button" onClick={() => setQuery('')} aria-label="Clear search" className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </label>
              <Segmented
                label="Show"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: 'all', label: 'All' },
                  { value: 'errors', label: 'With mistakes' },
                  { value: 'exact', label: 'Perfect' },
                ]}
              />
            </div>
            <div className="mt-6">
              <DiffLegend />
            </div>

            {trans.status === 'loading' ? (
              <Skeleton className="mt-8 h-40" />
            ) : !T.length ? (
              <p className="mt-8 text-ink-2">Transcripts appear here once they are published.</p>
            ) : visible.length ? (
              <>
                <ul className="mt-8 space-y-4">
                  {shown.map(({ t, tokens, s }) => (
                    <li key={t.id} className="rounded-2xl bg-wash p-6 sm:p-8">
                      <div className="mb-6 flex items-baseline justify-between gap-4">
                        <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold">
                          {titleCase(t.language)}
                          {t.script_mismatch && <span className="rounded-full bg-proof-soft px-2.5 py-0.5 text-[12px] font-medium text-proof-ink">Wrong script</span>}
                        </p>
                        <p className="text-[15px] text-ink-2">
                          {s.errors === 0 ? (
                            'Perfect'
                          ) : t.char_level ? (
                            <>
                              <span className="text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums">{rate(t.cer, 0)}</span> characters wrong
                            </>
                          ) : (
                            <>
                              <span className="text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums">
                                {t.wer !== undefined ? pct(t.wer, 0) : s.wer === null ? 'n/a' : pct(s.wer, 0)}
                              </span>{' '}
                              words wrong
                            </>
                          )}
                          {trans.isSample && <Flag kind="S" />}
                          {t.wer === undefined && !t.char_level && s.errors > 0 && <Flag kind="C" />}
                        </p>
                      </div>
                      {t.char_level && <p className="-mt-3 mb-4 text-[13px] text-ink-3">Compared character by character: this language is written without spaces.</p>}
                      <ProofLines tokens={tokens} size="lg" />
                    </li>
                  ))}
                </ul>
                {visible.length > PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAll((v) => !v)}
                    className="mt-8 inline-flex h-11 items-center rounded-full border border-rule-2 bg-paper px-6 text-[15px] font-medium transition-colors hover:border-ink"
                  >
                    {showAll ? 'Show fewer' : `Show all ${visible.length}`}
                  </button>
                )}
              </>
            ) : (
              <p className="mt-8 text-ink-2">No matching recordings{selected ? '. Try “All” languages' : ''}.</p>
            )}
          </Disclosure>

          {accents && (
            <Disclosure title="Accent test details" summary="How the accent comparison works, every group, and its limits.">
              <AccentDetails data={accents} />
            </Disclosure>
          )}

          <Disclosure title="How the numbers are measured" summary="In plain terms, and the two technical names.">
            <div className="max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-2">
              <p>
                The big numbers above count <strong className="font-semibold text-ink">letters wrong out of every 100</strong>: the share of what was said that AI wrote
                differently, missed or added. 0 is a perfect copy. This is called Character Error Rate (CER), and it works for every language, including Chinese languages
                written without spaces.
              </p>
              <p className="rounded-md bg-paper px-4 py-3 font-mono text-[14px] text-ink">WER = (substituted + missed + added words) / words said</p>
              <p>Word Error Rate (WER) is the same idea counted in words. It is shown in the charts above for languages that are written with spaces.</p>
              {accents && <p>The accent section counts words instead of letters (WER), because English is written with spaces.</p>}
              <p>Both describe text, not people: a 20% error rate does not mean 20% of speakers are affected.</p>
            </div>
          </Disclosure>
          <Disclosure title="About the data" summary="Sources, limits and how figures are calculated.">
            <Notes
              flags={flags}
              sources={[
                { label: 'Results', value: <><Code>language_results.json</Code>, <Code>transcription_results.json</Code>, analysis team pipeline</> },
                { label: 'Model', value: 'ElevenLabs Scribe, run twice on every recording: language guessed, and language given' },
                ...(accents ? [{ label: 'Accents', value: <>{accents.source.dataset} (<a href={accents.source.url} target="_blank" rel="noopener noreferrer" className="underline">accent.gmu.edu</a>): one English paragraph read by {accents.native.speakers + accents.accented.speakers} people</> }] : []),
                {
                  label: 'Audio',
                  value: (
                    <>
                      <a href="https://huggingface.co/datasets/google/fleurs" target="_blank" rel="noopener noreferrer" className="underline">
                        FLEURS
                      </a>{' '}
                      (Google, CC BY 4.0): read speech, not real service requests
                    </>
                  ),
                },
              ]}
            >
              Five languages were tested on 40 recordings each; the rest on 5, which is too few for firm conclusions. The side-by-side view calls a gap under one
              percentage point “about the same”. Word matching in the browser ignores case and punctuation.
            </Notes>
          </Disclosure>
        </div>
      </Chapter>
    </>
  )
}

const int0 = (n: number) => n.toLocaleString('en-CA')

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-10 rounded-full border px-4 text-[14px] font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-95 ${
        active ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink-2 hover:border-ink-3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}
