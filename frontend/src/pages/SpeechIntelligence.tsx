import { Search, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { DataIssues } from '../components/DataIssues'
import { Disclosure } from '../components/Disclosure'
import { Code, Skeleton } from '../components/EmptyState'
import { ErrorRateChart, type Metric } from '../components/ErrorRateChart'
import { Flag } from '../components/Flag'
import { Notes } from '../components/Notes'
import { Segmented } from '../components/Segmented'
import { CountUp } from '../components/story/CountUp'
import { Chapter, Container, Waveform, Words } from '../components/story/Story'
import { DiffLegend, ProofLines } from '../components/TranscriptDiff'
import { useDataset } from '../hooks/useDataset'
import { diffWords, summarise } from '../lib/diff'
import type { FlagKind } from '../lib/flags'
import { int, pct, titleCase } from '../lib/format'
import { inMode, meanOf, MODE_LABEL, modesOf, orMinus, PRIMARY_MODE, rate } from '../lib/speech'
import { loadLanguageResults, loadTranscriptions } from '../services/dataService'

type TranscriptFilter = 'all' | 'errors' | 'exact'
const PREVIEW = 3

export function SpeechIntelligence() {
  const langs = useDataset(loadLanguageResults)
  const trans = useDataset(loadTranscriptions)

  const [selected, setSelected] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('wer')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TranscriptFilter>('all')
  const [showAll, setShowAll] = useState(false)
  const [mode, setMode] = useState<string>(PRIMARY_MODE)

  // Each clip was run twice (language detected / language given); show one mode at a time.
  const modes = useMemo(() => modesOf(langs.data), [langs.data])
  const L = useMemo(() => inMode(langs.data, modes.length ? mode : null), [langs.data, modes, mode])
  const T = useMemo(() => inMode(trans.data, modes.length ? mode : null), [trans.data, modes, mode])

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
  const selRow = L.find((l) => l.language_code === selected)
  const selName = languages.find((l) => l.code === selected)?.name
  const rank = selRow && selRow[metric] !== null ? [...L].sort((a, b) => orMinus(b[metric]) - orMinus(a[metric])).indexOf(selRow) + 1 : 0
  const S = langs.isSample ? <Flag kind="S" /> : null
  const meanWer = meanOf(L.map((l) => l.wer))
  const meanCer = meanOf(L.map((l) => l.cer))
  const werLangs = L.filter((l) => l.wer !== null).length
  const shown = showAll ? visible : visible.slice(0, PREVIEW)
  const clipsPerLanguage = L[0]?.clips_tested

  const flags: FlagKind[] = []
  if (langs.isSample || trans.isSample) flags.push('S')
  if (T.some((t) => t.wer === undefined && !t.char_level)) flags.push('C')

  return (
    <>
      {/* Intro + headline numbers: the selected language, or all languages */}
      <Chapter tone="ink" size="l" label="Introduction">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="text-[clamp(2.5rem,5vw,4.25rem)] leading-none font-semibold tracking-[-0.04em]">
              <Words text="Understood?" />
            </h1>
            <p className="mt-4 max-w-[38ch] text-[17px] text-white/60">
              How accurately AI writes down each language. Lower is better.
              {clipsPerLanguage && !langs.isSample ? ` Early results: ${clipsPerLanguage} read-speech clips per language.` : ''}
            </p>
          </div>
          {modes.length > 1 ? (
            <div className="flex flex-col items-start gap-2 sm:items-end">
              <span className="text-[13px] text-white/50">How the AI was asked</span>
              <div role="radiogroup" aria-label="Transcription mode" className="inline-flex rounded-full bg-white/10 p-1">
                {modes.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={mode === m}
                    onClick={() => setMode(m)}
                    className={`h-9 rounded-full px-4 text-[14px] font-medium transition-colors duration-200 ${mode === m ? 'bg-paper text-ink' : 'text-white/70 hover:text-paper'}`}
                  >
                    {MODE_LABEL[m] ?? m}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <Waveform bars={28} tone="ink" misheard={[6, 7, 19]} className="!h-12 w-full max-w-[280px] opacity-80" />
          )}
        </div>
        <div key={`${mode}-${selected ?? 'all'}`} className="swap-in mt-16 border-t border-white/15 pt-8">
          <p className="text-[15px] text-white/60">
            {selName ? titleCase(selName) : 'All languages'}
            {modes.length > 1 && ` · ${MODE_LABEL[mode] ?? mode}`}
          </p>
          {langs.status === 'loading' ? (
            <Skeleton className="mt-6 h-24 bg-white/10" />
          ) : selRow ? (
            <dl className="mt-6 grid grid-cols-2 gap-x-10 gap-y-10 lg:grid-cols-4">
              <Big
                label={selRow.wer === null ? 'no WER: written without spaces' : 'of words wrong (WER)'}
                value={<>{rate(selRow.wer)}{selRow.wer !== null && S}</>}
                note={selRow.wer_ci ? `95% range ${rate(selRow.wer_ci[0], 0)}–${rate(selRow.wer_ci[1], 0)}` : undefined}
              />
              <Big
                label="of characters wrong (CER)"
                value={<>{rate(selRow.cer)}{S}</>}
                note={selRow.cer_ci ? `95% range ${rate(selRow.cer_ci[0], 0)}–${rate(selRow.cer_ci[1], 0)}` : undefined}
              />
              <Big label="recordings tested" value={<>{int(selRow.clips_tested)}{S}</>} />
              {selRow.pct_script_mismatch ? (
                <Big
                  label="of clips written in the wrong script"
                  value={`${Math.round(selRow.pct_script_mismatch)}%`}
                  note={selRow.cer_script_neutral != null ? `CER ignoring script: ${rate(selRow.cer_script_neutral)}` : undefined}
                />
              ) : (
                <Big label={`rank by ${metric.toUpperCase()}, worst first`} value={rank ? `${rank}/${L.length}` : '–'} />
              )}
            </dl>
          ) : selected ? (
            <p className="mt-6 text-[17px] text-white/70">No overall results for this language yet. Its recordings are below.</p>
          ) : L.length ? (
            <dl className="mt-6 grid grid-cols-2 gap-x-10 gap-y-10 lg:grid-cols-4">
              <Big
                label={werLangs < L.length ? `of words wrong, average of ${werLangs} languages` : 'of words wrong, on average'}
                value={meanWer === null ? '–' : <><CountUp value={meanWer} format={(n) => pct(n)} />{S}</>}
              />
              <Big label="of characters wrong, on average" value={meanCer === null ? '–' : <><CountUp value={meanCer} format={(n) => pct(n)} />{S}</>} />
              <Big label="recordings tested" value={<><CountUp value={L.reduce((n, l) => n + l.clips_tested, 0)} />{S}</>} />
              <Big label="languages" value={<><CountUp value={L.length} duration={600} />{S}</>} />
            </dl>
          ) : (
            <p className="mt-6 text-white/70">No results yet.</p>
          )}
        </div>
      </Chapter>

      <Container className="pt-8 empty:hidden">
        <DataIssues
          datasets={[
            { label: 'Language results', file: 'language_results.json', ds: langs },
            { label: 'Transcription results', file: 'transcription_results.json', ds: trans },
          ]}
        />
      </Container>

      {/* The chart */}
      <Chapter size="l" label="Error rate by language">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <h2 className="reveal display-m max-w-[14ch]">Every language, side by side.</h2>
          <div className="flex flex-wrap items-center gap-3">
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

        <div className="mt-10 flex flex-wrap gap-2" role="group" aria-label="Focus a language">
          <Chip active={selected === null} onClick={() => setSelected(null)}>
            All
          </Chip>
          {languages.map((l) => (
            <Chip key={l.code} active={selected === l.code} onClick={() => toggle(l.code)}>
              {titleCase(l.name)}
            </Chip>
          ))}
        </div>

        <div className="reveal mt-12">
          {langs.status === 'loading' ? (
            <Skeleton className="h-80" />
          ) : L.length ? (
            <ErrorRateChart data={L} rankBy={metric} selected={selected} onSelect={toggle} />
          ) : (
            <p className="text-ink-2">Results appear here once the analysis is published.</p>
          )}
        </div>
      </Chapter>

      {/* Transcripts */}
      <Chapter tone="wash" size="l" label="Transcripts">
        <h2 className="reveal display-m max-w-[16ch]">What was said. What AI heard.</h2>
        <div className="mt-10 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
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
                <li key={t.id} className="reveal lift rounded-2xl bg-paper p-6 sm:p-8">
                  <div className="mb-6 flex items-baseline justify-between gap-4">
                    <p className="flex flex-wrap items-center gap-2 text-[17px] font-semibold">
                      {titleCase(t.language)}
                      {t.script_mismatch && (
                        <span className="rounded-full bg-proof-soft px-2.5 py-0.5 text-[12px] font-medium text-proof-ink">Wrong script</span>
                      )}
                    </p>
                    <p className="text-[15px] text-ink-2">
                      {s.errors === 0 ? (
                        'Perfect'
                      ) : t.char_level ? (
                        <>
                          <span className="text-[22px] font-semibold tracking-[-0.02em] text-ink tabular-nums">{rate(t.cer, 0)}</span> characters
                          wrong
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
      </Chapter>

      <Container className="pt-16 pb-20">
        <div className="border-t border-ink">
          <Disclosure title="What do WER and CER mean?" summary="The two error rates, in one minute.">
            <div className="max-w-[62ch] space-y-3 text-[15px] leading-relaxed text-ink-2">
              <p className="rounded-md bg-wash px-4 py-3 font-mono text-[14px] text-ink">WER = (substituted + missed + added words) / words said</p>
              <p>
                Word Error Rate is the share of words the AI got wrong. 0% is a perfect transcript. Character Error Rate is
                the same idea counted in letters, which is fairer for languages written without spaces.
              </p>
              <p>Both describe words, not people: a 20% WER does not mean 20% of speakers are affected.</p>
            </div>
          </Disclosure>
          <Disclosure title="About the data" summary="Sources and how figures are calculated.">
            <Notes
              flags={flags}
              sources={[
                { label: 'Results', value: <><Code>language_results.json</Code>, <Code>transcription_results.json</Code>, analysis team pipeline</> },
                { label: 'Model', value: 'ElevenLabs Scribe, run with language detected and with language given' },
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
              Averages are over a small number of clips per language, with 95% ranges shown where available. Treat them as
              early signals, not definitive rankings.{' '}
              Word matching in the browser ignores case and punctuation. Scripts without spaces between words match as a
              single word; read CER for those languages.
            </Notes>
          </Disclosure>
        </div>
      </Container>
    </>
  )
}

function Big({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="flex flex-col-reverse">
      {note && <dd className="mt-1 text-[13px] text-white/45">{note}</dd>}
      <dt className="mt-2 text-[15px] text-white/60">{label}</dt>
      <dd className="text-[clamp(2.5rem,6vw,4.5rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums">{value}</dd>
    </div>
  )
}

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
