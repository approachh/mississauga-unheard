import { AlertTriangle, ArrowDownRight, ArrowUpRight, FileDown } from 'lucide-react'
import { useMemo, useState } from 'react'
import { DataIssues } from '../components/DataIssues'
import { Disclosure } from '../components/Disclosure'
import { EmptyState, Skeleton } from '../components/EmptyState'
import { Segmented } from '../components/Segmented'
import { Chapter, Container, Words } from '../components/story/Story'
import { useDataset } from '../hooks/useDataset'
import { int, pct } from '../lib/format'
import { loadRoutingData } from '../services/dataService'
import type { RoutingData, RoutingMetric, RoutingMisroute } from '../types/data'

type DatasetName = RoutingMetric['dataset']
const DATASET_OPTIONS: { value: DatasetName; label: string }[] = [
  { value: 'minds14', label: 'MInDS-14' },
  { value: 'speech_massive', label: 'Speech-MASSIVE' },
]
const CSV_BASE = `${import.meta.env.BASE_URL}data/routing/`

export function RoutingIntelligence() {
  const routing = useDataset(loadRoutingData)
  const [dataset, setDataset] = useState<DatasetName>('minds14')
  const [language, setLanguage] = useState('all')
  const data = routing.data[0]

  const metrics = useMemo(
    () => data?.metrics.filter((row) => row.dataset === dataset) ?? [],
    [data, dataset],
  )
  const languages = useMemo(() => metrics.map((row) => row.language), [metrics])
  const selectedLanguage = languages.includes(language) ? language : 'all'
  const displayedMetric = metrics.find((row) => row.language === selectedLanguage)
  const shownMisroutes = useMemo(
    () =>
      (data?.misroutes ?? []).filter(
        (row) =>
          row.dataset === dataset &&
          (selectedLanguage === 'all' || row.language === selectedLanguage),
      ),
    [data, dataset, selectedLanguage],
  )
  const confusion = useMemo(
    () =>
      (data?.confusion ?? [])
        .filter(
          (row) =>
            row.dataset === dataset &&
            (selectedLanguage === 'all' || row.language === selectedLanguage) &&
            row.true_intent !== row.predicted_intent,
        )
        .sort((a, b) => b.count - a.count || a.true_intent.localeCompare(b.true_intent))
        .slice(0, 8),
    [data, dataset, selectedLanguage],
  )
  const selectedTests = useMemo(
    () =>
      (data?.testResults ?? []).filter(
        (row) =>
          row.dataset === dataset &&
          (selectedLanguage === 'all' || row.language === selectedLanguage),
      ),
    [data, dataset, selectedLanguage],
  )
  const selectedErrors = displayedMetric
    ? Math.round(displayedMetric.test_examples * (1 - displayedMetric.intent_accuracy))
    : null
  const testTotal = selectedTests.length
  const correctTotal = selectedTests.filter((row) => row.intent_correct).length
  const possibleAsrErrors = selectedTests.filter((row) => row.asr_induced_route_error).length
  const torontoTotal =
    data?.torontoRequestTypes.reduce((sum, row) => sum + row.request_count, 0) ?? 0

  return (
    <>
      <Chapter tone="ink" size="l" label="Request routing" className="voice-atmosphere">
        <div className="mx-auto max-w-[780px] text-center">
          <p className="text-[12px] font-medium tracking-[0.14em] text-[rgb(176_228_255/0.8)] uppercase">
            Request routing · early prototype test
          </p>
          <h1 className="mt-4 text-[clamp(2.5rem,5.6vw,4.25rem)] leading-[0.98] font-semibold tracking-[-0.045em]">
            <Words text="The right words." />
            <br />
            <Words text="The wrong place." offset={3} />
          </h1>
          <p className="lede mx-auto mt-5 max-w-[54ch] text-white/60">
            A voice service must understand what someone needs, not just transcribe what they said.
            Here, we test a simple request router on real multilingual speech.
          </p>
          <p className="mx-auto mt-6 max-w-[66ch] rounded-md border border-white/15 bg-white/[0.04] px-4 py-3 text-left text-[13px] leading-relaxed text-white/65">
            This is not a production 311 system. The test uses a small example-matching router
            after ElevenLabs transcription. The audio datasets are banking calls and assistant
            commands—not Mississauga 311 calls.
          </p>
        </div>
      </Chapter>

      <Container className="pt-8">
        <DataIssues
          datasets={[
            { label: 'Routing analysis', file: 'data/routing/*.csv', ds: routing },
          ]}
        />
      </Container>

      {routing.status === 'loading' ? (
        <Container className="space-y-5 py-16">
          <Skeleton className="h-24 max-w-2xl" />
          <Skeleton className="h-80" />
        </Container>
      ) : !data ? (
        <Container className="py-16">
          <EmptyState icon={AlertTriangle} title="Routing results are not available">
            Add the routing CSV exports under <code>public/data/routing/</code> and reload this
            page.
          </EmptyState>
        </Container>
      ) : (
        <>
          <Chapter size="l" label="How often did the prototype route correctly?">
            <header className="flex flex-col gap-6 border-b border-ink pb-8 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="text-[12px] font-medium tracking-[0.12em] text-ink-3 uppercase">
                  Held-out test examples
                </p>
                <h2 className="display-m mt-3 max-w-[16ch]">Sometimes, it chose the wrong queue.</h2>
                <p className="mt-4 max-w-[56ch] text-[15px] leading-relaxed text-ink-2">
                  Each bar is the share of test requests whose expected intent or scenario matched
                  the router’s prediction. Higher is better. These scores describe this baseline
                  and this sample, not the general performance of voice AI.
                </p>
              </div>
              <Segmented
                label="Choose request dataset"
                value={dataset}
                onChange={(value) => {
                  setDataset(value)
                  setLanguage('all')
                }}
                options={DATASET_OPTIONS}
              />
            </header>

            <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
              <section aria-label="Intent accuracy by language">
                <div className="space-y-5">
                  {metrics.map((row, index) => {
                    const wrong = Math.max(
                      0,
                      row.test_examples - Math.round(row.test_examples * row.intent_accuracy),
                    )
                    return (
                      <button
                        key={row.language}
                        type="button"
                        aria-pressed={selectedLanguage === row.language}
                        onClick={() =>
                          setLanguage((current) => (current === row.language ? 'all' : row.language))
                        }
                        className="group block w-full rounded-md text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
                      >
                        <span className="mb-1.5 flex flex-wrap items-baseline justify-between gap-2">
                          <span className="font-medium group-hover:underline">
                            {row.language}
                            <span className="ml-2 text-[12px] font-normal text-ink-3">
                              {int(row.test_examples)} test examples
                            </span>
                          </span>
                          <span className="font-mono text-[13px] tabular-nums">
                            {pct(row.intent_accuracy)} correct
                            <span className="ml-2 text-proof-ink">· {wrong} misrouted</span>
                          </span>
                        </span>
                        <span className="flex h-2.5 overflow-hidden rounded-full bg-wash">
                          <span
                            className={`grow-x rounded-full ${selectedLanguage === row.language ? 'bg-proof' : 'bg-ink'}`}
                            style={{
                              width: `${row.intent_accuracy * 100}%`,
                              ['--i' as string]: index,
                            }}
                          />
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-rule pt-4 text-[13px] text-ink-3">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-ink" aria-hidden />
                    Correctly routed
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-proof" aria-hidden />
                    Selected language
                  </span>
                  <span>Choose a language to filter errors below.</span>
                </div>
              </section>

              <div className="border-t border-rule pt-6 lg:border-t-0 lg:border-l lg:border-rule lg:pt-0 lg:pl-8">
                <p className="text-[12px] font-medium tracking-[0.12em] text-ink-3 uppercase">
                  Current view · {selectedLanguage === 'all' ? 'all languages' : selectedLanguage}
                </p>
                <p className="mt-5 text-[clamp(3rem,6vw,5rem)] leading-none font-semibold tracking-[-0.05em] tabular-nums">
                  {correctTotal}
                  <span className="text-ink-3">/{testTotal}</span>
                </p>
                <p className="mt-3 text-[16px] text-ink-2">test requests routed to the expected category</p>
                <div className="mt-8 grid grid-cols-2 gap-4 border-t border-rule pt-5">
                  <Stat
                    value={int(shownMisroutes.length)}
                    label="wrong predictions in the CSV"
                    tone="proof"
                  />
                  <Stat
                    value={int(possibleAsrErrors)}
                    label="where reference text routed correctly but Scribe text did not"
                  />
                </div>
                {selectedLanguage !== 'all' && selectedErrors !== null && displayedMetric && (
                  <p className="mt-5 text-[13px] leading-relaxed text-ink-3">
                    {selectedErrors} of {displayedMetric.test_examples} examples in this language
                    were misrouted. One example changes the score by{' '}
                    {pct(1 / displayedMetric.test_examples, 1)}.
                  </p>
                )}
              </div>
            </div>

            <div className="mt-14 border-t border-rule pt-8">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h3 className="text-[20px] font-semibold tracking-[-0.02em]">What got confused?</h3>
                  <p className="mt-1 text-[14px] text-ink-3">
                    Most frequent wrong destination pairs in this test sample.
                  </p>
                </div>
                <DownloadLink file="routing_confusion.csv" />
              </div>
              {confusion.length ? (
                <div className="mt-5 overflow-x-auto">
                  <table className="w-full min-w-[560px] border-collapse text-left text-[14px]">
                    <thead>
                      <tr className="border-b border-rule text-[12px] text-ink-3">
                        <th className="py-2 pr-4 font-medium">Language</th>
                        <th className="py-2 pr-4 font-medium">Expected category</th>
                        <th className="py-2 pr-4 font-medium">Predicted category</th>
                        <th className="py-2 text-right font-medium">Examples</th>
                      </tr>
                    </thead>
                    <tbody>
                      {confusion.map((row, index) => (
                        <tr key={`${row.language}-${row.true_intent}-${row.predicted_intent}-${index}`} className="border-b border-rule">
                          <td className="py-3 pr-4 text-ink-3">{row.language}</td>
                          <td className="py-3 pr-4 font-medium">{humanLabel(row.true_intent)}</td>
                          <td className="py-3 pr-4 text-proof-ink">{humanLabel(row.predicted_intent)}</td>
                          <td className="py-3 text-right tabular-nums">{int(row.count)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-5 text-[14px] text-ink-3">
                  No wrong-category pairs in the selected view.
                </p>
              )}
            </div>
          </Chapter>

          <Chapter tone="wash" size="l" label="Misrouted examples">
            <div className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[12px] font-medium tracking-[0.12em] text-ink-3 uppercase">
                  Error review
                </p>
                <h2 className="display-m mt-3">A misroute is a missed need.</h2>
                <p className="mt-4 max-w-[60ch] text-[15px] leading-relaxed text-ink-2">
                  These examples show what the dataset expected, what the prototype predicted, and
                  what Scribe transcribed. They identify a possible wrong queue—not what happened
                  to a real caller afterward.
                </p>
              </div>
              <DownloadLink file="routing_misroutes.csv" />
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={selectedLanguage === 'all'}
                onClick={() => setLanguage('all')}
                className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${selectedLanguage === 'all' ? 'border-ink bg-ink text-paper' : 'border-rule-2 bg-paper text-ink-2 hover:border-ink'}`}
              >
                All languages
              </button>
              {languages.map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selectedLanguage === name}
                  onClick={() => setLanguage(name)}
                  className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-colors ${selectedLanguage === name ? 'border-ink bg-ink text-paper' : 'border-rule-2 bg-paper text-ink-2 hover:border-ink'}`}
                >
                  {name}
                </button>
              ))}
            </div>

            {shownMisroutes.length ? (
              <ul className="mt-8 space-y-4">
                {shownMisroutes.map((row) => (
                  <MisrouteCard
                    key={`${row.dataset}-${row.file}`}
                    row={row}
                  />
                ))}
              </ul>
            ) : (
              <p className="mt-8 rounded-xl border border-rule bg-paper px-5 py-6 text-[14px] text-ink-3">
                No misroutes for this language in the selected dataset sample.
              </p>
            )}

            {data.unscored.length > 0 && (
              <p className="mt-8 rounded-md border border-sample-line bg-sample-bg px-4 py-3 text-[13px] text-sample">
                {data.unscored.length} selected example(s) could not be scored and are listed in
                the unscored-export CSV.
              </p>
            )}
          </Chapter>

          <Chapter size="l" label="What city service requests look like">
            <header className="flex flex-wrap items-end justify-between gap-5">
              <div>
                <p className="text-[12px] font-medium tracking-[0.12em] text-ink-3 uppercase">
                  Toronto · 2025
                </p>
                <h2 className="display-m mt-3 max-w-[18ch]">What might a city line need to route?</h2>
                <p className="mt-4 max-w-[58ch] text-[15px] leading-relaxed text-ink-2">
                  A separate set of {int(torontoTotal)} Toronto service requests gives examples of
                  real municipal topics. It is context for designing a future test—not a
                  Mississauga dataset and not a validation set for these prototype scores.
                </p>
              </div>
              <DownloadLink file="toronto_311_request_types.csv" />
            </header>

            <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(260px,0.85fr)]">
              <section aria-label="Most frequent Toronto request types">
                <h3 className="text-[17px] font-semibold">Common request types</h3>
                <p className="mt-1 text-[13px] text-ink-3">Top 10 in the provided 2025 extract.</p>
                <ol className="mt-6 space-y-4">
                  {data.torontoRequestTypes.slice(0, 10).map((row, index) => (
                    <li key={row.service_request_type}>
                      <div className="mb-1 flex items-baseline justify-between gap-3 text-[13px]">
                        <span className="min-w-0 font-medium">{row.service_request_type}</span>
                        <span className="shrink-0 font-mono text-ink-3">
                          {int(row.request_count)} · {row.share_percent.toFixed(2)}%
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-rule">
                        <div
                          className="grow-x h-full rounded-full bg-ink"
                          style={{
                            width: `${(row.request_count / (data.torontoRequestTypes[0]?.request_count || 1)) * 100}%`,
                            ['--i' as string]: index,
                          }}
                        />
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              <section aria-label="Toronto request volume by division">
                <h3 className="text-[17px] font-semibold">By city division</h3>
                <p className="mt-1 text-[13px] text-ink-3">Share of requests handled by each division.</p>
                <ol className="mt-6 divide-y divide-rule border-y border-rule">
                  {data.torontoDivisions.map((row, index) => (
                    <li key={row.division} className="py-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="flex min-w-0 items-center gap-2 text-[14px] font-medium">
                          {index === 0 ? <ArrowDownRight className="h-4 w-4 text-ink-3" aria-hidden /> : <ArrowUpRight className="h-4 w-4 text-ink-3" aria-hidden />}
                          {row.division}
                        </span>
                        <span className="shrink-0 font-mono text-[13px] tabular-nums">
                          {row.share_percent.toFixed(2)}%
                        </span>
                      </div>
                      <p className="mt-1 pl-6 text-[12px] text-ink-3">{int(row.request_count)} requests</p>
                    </li>
                  ))}
                </ol>
                <DownloadLink file="toronto_311_divisions.csv" className="mt-4" />
              </section>
            </div>
          </Chapter>

          <Container className="pb-20">
            <Disclosure
              title="How to read the routing comparison"
              summary="What the two accuracy scores and transcription errors can—and cannot—tell us."
            >
              <div className="max-w-[72ch] space-y-4 text-[14px] leading-relaxed text-ink-2">
                <p>
                  <strong className="text-ink">Intent accuracy</strong> is the fraction of held-out
                  requests where the predicted category matched the dataset label. MInDS-14 labels
                  are intents; Speech-MASSIVE is grouped by broader scenario because individual
                  intent examples are sparse.
                </p>
                <p>
                  <strong className="text-ink">Reference-text accuracy</strong> runs the same simple
                  router on the provided transcript instead of ElevenLabs’ transcript.
                  <strong className="text-ink"> ASR-induced route errors</strong> count examples
                  where reference text routes correctly but Scribe’s text does not. This comparison
                  helps identify a possible transcription contribution; it does not prove that the
                  transcript alone caused every mistake.
                </p>
                <p>
                  <strong className="text-ink">WER/CER</strong> compare transcript text with the
                  supplied reference. They are text-error measures, not routing accuracy. In this
                  data, the MInDS-14 reference text is English for a few non-English calls, so those
                  rows cannot be treated as reliable non-English transcription scores.
                </p>
                <p>
                  Toronto 311 is a stand-in for municipal request topics. It cannot tell us whether
                  Mississauga calls would be routed correctly, how callers were affected, or whether
                  an actual service request was resolved.
                </p>
              </div>
            </Disclosure>
            <Disclosure
              title="Browse all held-out test cases"
              summary={`${int(selectedTests.length)} examples in the selected dataset/language view.`}
            >
              <AllTests rows={selectedTests} />
              <div className="mt-5">
                <DownloadLink file="routing_test_results.csv" />
              </div>
            </Disclosure>
            <div className="mt-10 border-t border-rule pt-5 text-[13px] leading-relaxed text-ink-3">
              <p>
                Source files are the routing-analysis CSV exports. The displayed counts describe
                the currently published evaluation snapshot.
              </p>
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
                <DownloadLink file="routing_metrics.csv" label="Metrics CSV" />
                <DownloadLink file="routing_language_coverage.csv" label="Coverage CSV" />
                <DownloadLink file="routing_unscored_examples.csv" label="Unscored rows CSV" />
              </div>
            </div>
          </Container>
        </>
      )}
    </>
  )
}

function Stat({ value, label, tone }: { value: string; label: string; tone?: 'proof' }) {
  return (
    <div>
      <p className={`text-[clamp(1.75rem,4vw,2.5rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums ${tone === 'proof' ? 'text-proof-ink' : ''}`}>
        {value}
      </p>
      <p className="mt-2 text-[12px] leading-snug text-ink-3">{label}</p>
    </div>
  )
}

function humanLabel(label: string) {
  return label
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

function MisrouteCard({ row }: { row: RoutingMisroute }) {
  const referenceWasCorrect = row.reference_text_intent_correct
  return (
    <li className="rounded-2xl border border-rule bg-paper p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 text-[13px]">
          <span className="rounded-full bg-wash px-3 py-1 font-medium">{row.language}</span>
          <span className="font-mono text-ink-3">{row.dataset === 'minds14' ? 'MInDS-14' : 'Speech-MASSIVE'}</span>
        </div>
        <p className={`text-[12px] font-medium ${row.asr_induced_route_error ? 'text-proof-ink' : 'text-ink-3'}`}>
          {row.asr_induced_route_error
            ? 'Reference routed correctly; transcript changed the route'
            : referenceWasCorrect
              ? 'Router outcome differed between reference and transcript'
              : 'Reference text also missed this category'}
        </p>
      </div>
      <div className="mt-5 flex flex-wrap items-center gap-2 text-[14px]">
        <span className="rounded-md border border-rule px-3 py-1.5">
          Expected: <strong>{humanLabel(row.true_intent)}</strong>
        </span>
        <span aria-hidden className="text-proof-ink">→</span>
        <span className="rounded-md bg-proof-soft px-3 py-1.5 text-proof-ink">
          Predicted: <strong>{humanLabel(row.predicted_intent)}</strong>
        </span>
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <TextPanel title="Dataset reference" text={row.reference_text} />
        <TextPanel title="ElevenLabs transcript" text={row.elevenlabs_transcript} />
      </div>
      <p className="mt-4 text-[12px] text-ink-3">
        Text error · WER {pct(row.wer)} · CER {pct(row.cer)}
      </p>
    </li>
  )
}

function TextPanel({ title, text }: { title: string; text: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-wash p-4">
      <p className="text-[11px] font-semibold tracking-[0.1em] text-ink-3 uppercase">{title}</p>
      <p className="mt-2 break-words text-[14px] leading-relaxed text-ink-2">{text || 'No text available.'}</p>
    </div>
  )
}

function AllTests({ rows }: { rows: RoutingData['testResults'] }) {
  return (
    <div className="max-h-[560px] overflow-auto rounded-lg border border-rule">
      <table className="w-full min-w-[700px] border-collapse text-left text-[13px]">
        <thead className="sticky top-0 bg-wash text-ink-3">
          <tr>
            <th className="px-3 py-2 font-medium">Language</th>
            <th className="px-3 py-2 font-medium">Expected</th>
            <th className="px-3 py-2 font-medium">Predicted</th>
            <th className="px-3 py-2 text-right font-medium">Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.dataset}-${row.file}`} className="border-t border-rule">
              <td className="px-3 py-2">{row.language}</td>
              <td className="px-3 py-2">{humanLabel(row.true_intent)}</td>
              <td className={`px-3 py-2 ${row.intent_correct ? '' : 'text-proof-ink'}`}>
                {humanLabel(row.predicted_intent)}
              </td>
              <td className="px-3 py-2 text-right">{row.intent_correct ? 'Correct' : 'Misroute'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function DownloadLink({ file, label, className = '' }: { file: string; label?: string; className?: string }) {
  return (
    <a
      href={`${CSV_BASE}${file}`}
      download
      className={`inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 underline decoration-rule-2 underline-offset-4 transition-colors hover:text-ink hover:decoration-ink ${className}`}
    >
      <FileDown className="h-3.5 w-3.5" aria-hidden />
      {label ?? `Download ${file.replace('.csv', '').replaceAll('_', ' ')}`}
    </a>
  )
}
