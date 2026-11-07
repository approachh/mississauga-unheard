import { BarChart3, FileText, Search, X } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { DataIssues } from '../components/DataIssues'
import { Code, EmptyState, Skeleton } from '../components/EmptyState'
import { ErrorRateChart } from '../components/ErrorRateChart'
import { Flag } from '../components/Flag'
import type { FlagKind } from '../lib/flags'
import { Notes } from '../components/Notes'
import type { Metric } from '../components/RankedTable'
import { PageTitle, Section } from '../components/Section'
import { Segmented } from '../components/Segmented'
import { DiffLegend, ProofLines } from '../components/TranscriptDiff'
import { useDataset } from '../hooks/useDataset'
import { diffWords, summarise } from '../lib/diff'
import { int, pct, titleCase } from '../lib/format'
import { loadLanguageResults, loadTranscriptions } from '../services/dataService'

type TranscriptFilter = 'all' | 'errors' | 'exact'

export function SpeechIntelligence() {
  const langs = useDataset(loadLanguageResults)
  const trans = useDataset(loadTranscriptions)

  const [selected, setSelected] = useState<string | null>(null)
  const [metric, setMetric] = useState<Metric>('wer')
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<TranscriptFilter>('all')

  // Union of languages from both files so transcript-only languages are still selectable.
  const languages = useMemo(() => {
    const m = new Map<string, string>()
    for (const l of langs.data) m.set(l.language_code, l.language)
    for (const t of trans.data) if (!m.has(t.language_code)) m.set(t.language_code, t.language)
    return [...m].map(([code, name]) => ({ code, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [langs.data, trans.data])

  const diffs = useMemo(
    () => trans.data.map((t) => {
      const tokens = diffWords(t.reference, t.hypothesis)
      return { t, tokens, s: summarise(tokens) }
    }),
    [trans.data],
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
  const selRow = langs.data.find((l) => l.language_code === selected)
  const selName = languages.find((l) => l.code === selected)?.name
  const rank = selRow ? [...langs.data].sort((a, b) => b[metric] - a[metric]).indexOf(selRow) + 1 : 0
  const S = langs.isSample ? <Flag kind="S" /> : null

  const flags: FlagKind[] = []
  if (langs.isSample || trans.isSample) flags.push('S')
  if (trans.data.some((t) => t.wer === undefined)) flags.push('C')

  return (
    <div className="space-y-12 sm:space-y-16">
      <PageTitle
        title="Understood?"
        lede="Research question 1. How accurately ElevenLabs Scribe transcribes each language; lower error rates mean the AI heard more of what was actually said."
      />

      <DataIssues
        datasets={[
          { label: 'Language results', file: 'language_results.json', ds: langs },
          { label: 'Transcription results', file: 'transcription_results.json', ds: trans },
        ]}
      />

      {/* Filters scope everything below */}
      <div className="flex flex-col gap-4 border-y border-rule py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className="shrink-0 pt-1.5 text-[13px] font-medium text-ink-3 sm:pt-0">Language</span>
          {langs.status === 'loading' ? (
            <Skeleton className="h-8 w-80" />
          ) : (
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by language">
              <Chip active={selected === null} onClick={() => setSelected(null)}>
                All
              </Chip>
              {languages.map((l) => (
                <Chip key={l.code} active={selected === l.code} onClick={() => toggle(l.code)}>
                  {titleCase(l.name)}
                </Chip>
              ))}
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="text-[13px] font-medium text-ink-3">Rank by</span>
          <Segmented
            label="Rank by metric"
            value={metric}
            onChange={setMetric}
            options={[
              { value: 'wer', label: 'WER' },
              { value: 'cer', label: 'CER' },
            ]}
          />
        </div>
      </div>

      <div className="grid gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-labelledby="chart-h">
          <h2 id="chart-h" className="mb-4 text-xl font-semibold tracking-[-0.015em]">
            Error rate by language
          </h2>
          {langs.status === 'loading' ? (
            <Skeleton className="h-72" />
          ) : langs.data.length ? (
            <>
              <ErrorRateChart data={langs.data} rankBy={metric} selected={selected} onSelect={toggle} />
              <p className="mt-3 flex flex-wrap justify-between gap-x-6 gap-y-1 text-[12px] text-ink-3">
                <span>
                  Source: <Code>{langs.isSample ? 'language_results.sample.json' : 'language_results.json'}</Code>
                </span>
                <span>Select a bar or a language to focus it.</span>
              </p>
            </>
          ) : (
            <EmptyState icon={BarChart3} title="No language results">
              Add <Code>language_results.json</Code> to <Code>public/data/</Code>.
            </EmptyState>
          )}
        </section>

        <aside className="space-y-8">
          <div aria-live="polite">
            <h2 className="text-xl font-semibold tracking-[-0.015em]">{selName ? titleCase(selName) : 'All languages'}</h2>
            {selected && !selRow ? (
              <p className="mt-3 text-[14px] text-ink-3">No aggregate results for this language yet. Transcripts below.</p>
            ) : selRow ? (
              <dl className="mt-3 divide-y divide-rule border-y border-rule text-[14px]">
                <Row label="Word Error Rate" value={<>{pct(selRow.wer)}{S}</>} />
                <Row label="Character Error Rate" value={<>{pct(selRow.cer)}{S}</>} />
                <Row label="Clips tested" value={<>{int(selRow.clips_tested)}{S}</>} />
                <Row label={`Rank by ${metric.toUpperCase()}`} value={`${rank} of ${langs.data.length}`} />
              </dl>
            ) : langs.data.length ? (
              <dl className="mt-3 divide-y divide-rule border-y border-rule text-[14px]">
                <Row
                  label="Mean WER, unweighted"
                  value={<>{pct(langs.data.reduce((n, l) => n + l.wer, 0) / langs.data.length)}{S}</>}
                />
                <Row
                  label="Mean CER, unweighted"
                  value={<>{pct(langs.data.reduce((n, l) => n + l.cer, 0) / langs.data.length)}{S}</>}
                />
                <Row
                  label="Spread, highest to lowest WER"
                  value={
                    <>
                      {((Math.max(...langs.data.map((l) => l.wer)) - Math.min(...langs.data.map((l) => l.wer))) * 100).toFixed(1)}
                      <span className="ml-0.5 text-[13px] font-normal text-ink-3">pts</span>
                      {S}
                    </>
                  }
                />
              </dl>
            ) : (
              <p className="mt-3 text-[14px] text-ink-3">No data yet.</p>
            )}
          </div>

          <div className="text-[14px] leading-relaxed text-ink-2">
            <h2 className="mb-2 font-semibold text-ink">Reading WER and CER</h2>
            <p className="mb-2 rounded-md bg-wash px-3 py-2 font-mono text-[13px] text-ink">WER = (S + D + I) / N</p>
            <p>
              Substituted, deleted and inserted words, divided by the number of words in the reference. 0% is a
              perfect transcript.
            </p>
            <p className="mt-2">
              CER is the same calculation on characters. It is fairer for scripts written without spaces and less
              harsh on small spelling slips.
            </p>
          </div>
        </aside>
      </div>

      <Section
        id="transcripts"
        title="What was said, what AI heard"
        description="Each clip's reference text against the ElevenLabs transcript, with every difference marked."
      >
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <label className="relative block md:w-80">
            <span className="sr-only">Search transcripts</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search words, clip IDs, languages"
              className="h-10 w-full rounded-md border border-rule-2 bg-paper pr-9 pl-9 text-[14px] transition-colors hover:border-ink-3 focus:border-ink focus:outline-none [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-1 text-ink-3 hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </label>
          <Segmented
            label="Transcript filter"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'All' },
              { value: 'errors', label: 'With errors' },
              { value: 'exact', label: 'Exact' },
            ]}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink pb-2.5">
          <DiffLegend />
          <p className="text-[13px] text-ink-3">
            {visible.length} of {trans.data.length} clips
            {selName && <> · {titleCase(selName)}</>}
          </p>
        </div>

        {trans.status === 'loading' ? (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        ) : !trans.data.length ? (
          <div className="pt-5">
            <EmptyState icon={FileText} title="No transcripts yet">
              Add <Code>transcription_results.json</Code> to compare individual clips.
            </EmptyState>
          </div>
        ) : visible.length ? (
          <ul>
            {visible.map(({ t, tokens, s }) => (
              <li key={t.id} className="grid gap-x-8 gap-y-3 border-b border-rule py-5 md:grid-cols-[180px_minmax(0,1fr)]">
                <div className="flex items-start justify-between gap-4 md:block">
                  <div>
                    <p className="font-medium">{titleCase(t.language)}</p>
                    <p className="font-mono text-[11px] text-ink-3">{t.id}</p>
                  </div>
                  <div className="text-right md:mt-3 md:text-left">
                    <p className="text-[17px] font-semibold">
                      {t.wer !== undefined ? pct(t.wer) : s.wer === null ? 'n/a' : pct(s.wer)}
                      <span className="ml-1 text-[12px] font-normal text-ink-3">WER</span>
                      {trans.isSample && <Flag kind="S" />}
                      {t.wer === undefined && <Flag kind="C" />}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {s.errors === 0 ? 'Exact match' : `${s.substitutions} sub · ${s.deletions} missed · ${s.insertions} added`}
                    </p>
                  </div>
                </div>
                <ProofLines tokens={tokens} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="pt-5">
            <EmptyState icon={Search} title="No matching clips">
              Try another search{selected ? ', or choose All languages' : ''}.
            </EmptyState>
          </div>
        )}
      </Section>

      <Notes
        flags={flags}
        sources={[
          { label: 'Aggregates', value: <><Code>language_results.json</Code>, analysis team (Python)</> },
          { label: 'Transcripts', value: <><Code>transcription_results.json</Code>, ElevenLabs Scribe output</> },
        ]}
      >
        Word alignment in the browser ignores case and punctuation. Scripts written without spaces between words align
        as a single token; read CER for those languages.
      </Notes>
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-8 shrink-0 rounded-md border px-3 text-[13px] font-medium transition-colors duration-150 ${
        active ? 'border-ink bg-ink text-paper' : 'border-rule-2 text-ink-2 hover:border-ink-3 hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-ink-2">{label}</dt>
      <dd className="text-[17px] font-semibold">{value}</dd>
    </div>
  )
}
