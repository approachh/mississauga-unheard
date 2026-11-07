import { ArrowRight, BarChart3, FileText } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { DataIssues } from '../components/DataIssues'
import { Code, EmptyState, Skeleton } from '../components/EmptyState'
import { Flag } from '../components/Flag'
import { KeyFigure, KeyFigures } from '../components/KeyFigures'
import { Notes } from '../components/Notes'
import { RankedTable } from '../components/RankedTable'
import { Section } from '../components/Section'
import { DiffLegend, ProofLines } from '../components/TranscriptDiff'
import { useDataset } from '../hooks/useDataset'
import { diffWords, summarise } from '../lib/diff'
import type { FlagKind } from '../lib/flags'
import { int, pct, titleCase } from '../lib/format'
import { loadCitywideLanguages, loadLanguageResults, loadTranscriptions } from '../services/dataService'

export function Overview() {
  const langs = useDataset(loadLanguageResults)
  const trans = useDataset(loadTranscriptions)
  const census = useDataset(loadCitywideLanguages)

  const diffs = useMemo(
    () => trans.data.map((t) => {
      const tokens = diffWords(t.reference, t.hypothesis)
      return { t, tokens, s: summarise(tokens) }
    }),
    [trans.data],
  )
  const wordErrors = diffs.reduce((n, d) => n + d.s.errors, 0)
  // Specimen: the transcript with the most marks, so the mechanism is visible.
  const specimen = [...diffs].sort((a, b) => b.s.errors - a.s.errors)[0]

  const ranked = [...langs.data].sort((a, b) => b.wer - a.wer)
  const worst = ranked[0]
  const best = ranked[ranked.length - 1]
  const recordings = langs.data.reduce((n, l) => n + l.clips_tested, 0)
  const langFlag = langs.isSample ? <Flag kind="S" /> : null

  const flags: FlagKind[] = []
  if (langs.isSample || trans.isSample) flags.push('S')
  if (trans.data.length) flags.push('C')

  return (
    <div className="space-y-16 sm:space-y-20">
      <div className="space-y-10">
        {/* Intro: the claim beside the mechanism */}
        <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
          <div className="lg:pt-2">
            <h1 className="text-[2.6rem] leading-[1.02] font-semibold tracking-[-0.035em] sm:text-[3.5rem]">
              What you say.
              <br />
              <span className="text-ink-3">What AI hears.</span>
            </h1>
            <p className="mt-5 max-w-[52ch] text-[17px] leading-relaxed text-ink-2">
              Voice AI is becoming the front door to public services. VOXELO measures how accurately it understands
              the languages and accents of Mississauga, and where the people it misunderstands live.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link
                to="/speech"
                className="inline-flex h-10 items-center gap-2 rounded-md bg-ink px-4 text-[14px] font-medium text-paper transition-colors hover:bg-ink-2"
              >
                Explore speech results <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a href="#method" className="inline-flex h-10 items-center rounded-md px-3 text-[14px] font-medium text-ink-2 hover:bg-wash hover:text-ink">
                How it works
              </a>
            </div>
          </div>

          <figure className="rounded-lg border border-rule-2 bg-paper">
            <figcaption className="flex items-center justify-between gap-3 border-b border-rule px-5 py-3 text-[13px]">
              <span className="text-ink-2">
                {specimen ? (
                  <>
                    {titleCase(specimen.t.language)} <span className="font-mono text-[11px] text-ink-3">{specimen.t.id}</span>
                  </>
                ) : (
                  'Transcript comparison'
                )}
              </span>
              {specimen && (
                <span className="text-ink-3">
                  WER{' '}
                  <strong className="font-semibold text-ink">
                    {specimen.t.wer !== undefined ? pct(specimen.t.wer) : specimen.s.wer === null ? 'n/a' : pct(specimen.s.wer)}
                  </strong>
                  {trans.isSample && <Flag kind="S" />}
                  {specimen.t.wer === undefined && <Flag kind="C" />}
                </span>
              )}
            </figcaption>
            <div className="px-5 py-6 sm:py-7">
              {trans.status === 'loading' ? (
                <Skeleton className="h-24" />
              ) : specimen ? (
                <div className="draw">
                  <ProofLines tokens={specimen.tokens} size="lg" />
                </div>
              ) : (
                <EmptyState icon={FileText} title="No transcripts yet">
                  A said/heard comparison appears here once <Code>transcription_results.json</Code> is published.
                </EmptyState>
              )}
            </div>
            {specimen && (
              <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-rule px-5 py-3">
                <DiffLegend />
                <p className="text-[13px] text-ink-3">
                  <strong className="font-semibold text-ink">{int(wordErrors)}</strong>
                  {trans.isSample && <Flag kind="S" />}
                  <Flag kind="C" /> words misheard in {int(trans.data.length)} clips
                </p>
              </div>
            )}
          </figure>
        </div>

        {/* Key figures */}
        {langs.status === 'loading' ? (
          <Skeleton className="h-20" />
        ) : langs.data.length > 0 ? (
          <KeyFigures>
            <KeyFigure label="Languages tested" value={<>{int(langs.data.length)}{langFlag}</>} />
            <KeyFigure label="Recordings analysed" value={<>{int(recordings)}{langFlag}</>} />
            <KeyFigure label={`Highest WER · ${titleCase(worst.language)}`} value={<>{pct(worst.wer)}{langFlag}</>} />
            <KeyFigure label={`Lowest WER · ${titleCase(best.language)}`} value={<>{pct(best.wer)}{langFlag}</>} />
          </KeyFigures>
        ) : null}
      </div>

      <DataIssues
        datasets={[
          { label: 'Language results', file: 'language_results.json', ds: langs },
          { label: 'Transcription results', file: 'transcription_results.json', ds: trans },
        ]}
      />

      <Section
        id="results"
        title="How well each language is understood"
        description="Word Error Rate by language, from ElevenLabs Scribe transcripts compared against reference text. Lower is better."
        action={
          <Link to="/speech" className="inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:underline">
            Open Speech Intelligence <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        }
      >
        {langs.status === 'loading' ? (
          <Skeleton className="h-64" />
        ) : !langs.data.length ? (
          <EmptyState icon={BarChart3} title="No speech results yet">
            Results appear here once the analysis team publishes <Code>language_results.json</Code>.
          </EmptyState>
        ) : (
          <>
            <RankedTable rows={langs.data} isSample={langs.isSample} barMetric="wer" caption="Error rates by language" />
            <p className="mt-3 text-[12px] text-ink-3">
              Source: <Code>{langs.isSample ? 'language_results.sample.json' : 'language_results.json'}</Code>
            </p>
          </>
        )}
      </Section>

      <Section id="questions" title="Two research questions">
        <ol className="divide-y divide-rule border-b border-rule">
          <Question
            to="/speech"
            title="Understood?"
            body="How accurately does voice AI recognise different languages and English accents?"
            status={langs.data.length ? (langs.isSample ? 'Dashboard ready, sample data' : 'Results available') : 'Awaiting results'}
            live={langs.data.length > 0}
          />
          <Question
            to="/community"
            title="Who’s unheard, and where?"
            body="Which Mississauga language communities may face accessibility barriers, and in which wards and neighbourhoods do they live?"
            status={census.data.length ? 'Census data available' : 'Awaiting census data'}
            live={census.data.length > 0}
          />
        </ol>
      </Section>

      <Section id="method" title="How the research works">
        <ol className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="grid grid-cols-[22px_1fr] border-t border-rule-2 pt-3">
              <span className="font-semibold text-ink-3">{i + 1}</span>
              <div>
                <p className="font-semibold">{s.title}</p>
                <p className="mt-1 text-[14px] leading-relaxed text-ink-2">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Notes
        flags={flags}
        sources={[
          { label: 'Speech results', value: <><Code>language_results.json</Code>, analysis team (Python)</> },
          { label: 'Transcripts', value: <><Code>transcription_results.json</Code>, ElevenLabs Scribe output</> },
          { label: 'Census', value: census.data.length ? 'Validated citywide and ward language data, census team' : 'Mississauga language data, pending from the research team' },
        ]}
      />
    </div>
  )
}

const STEPS = [
  { title: 'Collect speech', body: 'Recordings in many languages and English accents, each paired with a reference transcription.' },
  { title: 'Transcribe', body: 'Each clip is transcribed by ElevenLabs Scribe: exactly what the AI heard.' },
  { title: 'Measure', body: 'Word and Character Error Rates quantify the gap between what was said and what was recognised.' },
  { title: 'Map communities', body: 'Census language data shows where in Mississauga the most affected communities live.' },
]

function Question({ to, title, body, status, live }: { to: string; title: string; body: string; status: ReactNode; live?: boolean }) {
  return (
    <li>
      <Link to={to} className="group grid gap-x-8 gap-y-1 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <div>
          <p className="text-[19px] font-semibold tracking-[-0.01em] group-hover:underline">{title}</p>
          <p className="mt-1 max-w-[65ch] text-ink-2">{body}</p>
        </div>
        <p className="flex items-center gap-2 text-[13px] text-ink-3">
          <span className={`h-2 w-2 rounded-full border border-ink ${live ? 'bg-ink' : ''}`} aria-hidden />
          {status}
          <ArrowRight className="h-3.5 w-3.5 text-ink transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden />
        </p>
      </Link>
    </li>
  )
}
