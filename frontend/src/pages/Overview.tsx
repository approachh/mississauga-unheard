import { ArrowRight, Mic } from 'lucide-react'
import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { DataIssues } from '../components/DataIssues'
import { Disclosure } from '../components/Disclosure'
import { Code, Skeleton } from '../components/EmptyState'
import { Flag } from '../components/Flag'
import { Notes } from '../components/Notes'
import { CountUp } from '../components/story/CountUp'
import { LiveTranscript, type LiveExample } from '../components/story/LiveTranscript'
import { Chapter, Container, Words } from '../components/story/Story'
import { DiffLegend, ProofLines } from '../components/TranscriptDiff'
import { useDataset } from '../hooks/useDataset'
import { diffWords, summarise } from '../lib/diff'
import type { FlagKind } from '../lib/flags'
import { titleCase } from '../lib/format'
import { inMode, PRIMARY_MODE, rate } from '../lib/speech'
import { langKey } from '../lib/language'
import { loadCitywideLanguages, loadLanguageResults, loadSpeechCoverage, loadTranscriptions } from '../services/dataService'

export function Overview() {
  const langs = useDataset(loadLanguageResults)
  const trans = useDataset(loadTranscriptions)
  const census = useDataset(loadCitywideLanguages)
  const coverage = useDataset(loadSpeechCoverage)

  const census_ = useMemo(() => {
    if (!census.data.length) return null
    const ranking = [...census.data].sort((a, b) => a.rank - b.rank)
    const covBy = new Map(coverage.data.map((c) => [langKey(c.language), c]))
    const assessed = ranking.filter((c) => covBy.has(langKey(c.language)))
    const gap = assessed.filter((c) => covBy.get(langKey(c.language))?.has_service_request_audio === false)
    return { top: ranking[0], assessed: assessed.length, gap: gap.length }
  }, [census.data, coverage.data])

  // Readable examples: headline mode, word-level, not a wrong-script case (those mark every word),
  // with at least one mistake, shortest first so they fit. One per language.
  const scored = useMemo(() => {
    const seen = new Set<string>()
    return inMode(trans.data, PRIMARY_MODE)
      .filter((t) => !t.char_level && !t.script_mismatch)
      .map((t) => {
        const tokens = diffWords(t.reference, t.hypothesis)
        return { t, tokens, s: summarise(tokens) }
      })
      .filter((d) => d.s.errors > 0 && d.s.refWords <= 22)
      .sort((a, b) => a.s.refWords - b.s.refWords)
      .filter((d) => (seen.has(d.t.language) ? false : (seen.add(d.t.language), true)))
  }, [trans.data])

  // Specimen: the clearest single example (fewest words, at least two marks if possible).
  const specimen = scored.find((d) => d.s.errors >= 2) ?? scored[0]
  const examples = useMemo<LiveExample[]>(
    () => scored.slice(0, 6).map((d) => ({ id: d.t.id, language: d.t.language, tokens: d.tokens })),
    [scored],
  )

  const headline = inMode(langs.data, PRIMARY_MODE)
  const ranked = headline.filter((r) => r.wer !== null).sort((a, b) => (b.wer ?? 0) - (a.wer ?? 0))
  const cerOnly = headline.filter((r) => r.wer === null).map((r) => titleCase(r.language))
  const maxWer = Math.max(0.01, ...ranked.map((r) => r.wer ?? 0))
  const S = langs.isSample ? <Flag kind="S" /> : null

  const flags: FlagKind[] = []
  if (langs.isSample || trans.isSample) flags.push('S')
  if (trans.data.length) flags.push('C')

  return (
    <>
      {/* 1. The promise, demonstrated */}
      <Chapter size="l" label="Introduction" className="overflow-hidden">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
          <div>
            <h1 className="text-[clamp(2.75rem,5.2vw,4.5rem)] leading-[0.98] font-semibold tracking-[-0.04em]">
              <Words text="What you say." />
              <br />
              <span className="text-ink-3">
                <Words text="What AI hears." offset={3} />
              </span>
            </h1>
            <p className="lede mt-7 max-w-[30ch] text-ink-2">How well does voice AI understand the languages of Mississauga? We measure it.</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/voice" className="inline-flex h-12 items-center gap-2 rounded-full bg-ink px-6 text-[15px] font-medium text-paper transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]">
                <Mic className="h-4 w-4" aria-hidden /> Try your voice
              </Link>
              <a href="#findings" className="inline-flex h-12 items-center gap-2 rounded-full border border-rule-2 px-6 text-[15px] font-medium transition-colors hover:border-ink">
                See the findings
              </a>
            </div>
          </div>
          <div className="reveal-scale">
            <LiveTranscript examples={examples} isSample={trans.isSample} />
          </div>
        </div>
      </Chapter>

      {(langs.status !== 'loading' && trans.status !== 'loading') && (
        <Container>
          <DataIssues
            datasets={[
              { label: 'Language results', file: 'language_results.json', ds: langs },
              { label: 'Transcription results', file: 'transcription_results.json', ds: trans },
            ]}
          />
        </Container>
      )}

      {/* 2. Who lives here */}
      {census_ && (
        <Chapter tone="ink" size="xl" id="findings" label="Mississauga's languages">
          <p className="reveal text-[17px] text-white/60">In Mississauga,</p>
          <p className="reveal display-xl mt-4"><CountUp value={census_.top.home_speakers} /></p>
          <p className="reveal display-m mt-6 max-w-[18ch] text-white/90">
            people speak {census_.top.language} at home. It is the most common of {census.data.length} languages we tracked.
          </p>
        </Chapter>
      )}

      {/* 3. The gap */}
      {census_ && census_.assessed > 0 && (
        <Chapter size="xl" label="The testing gap">
          <div className="grid items-end gap-12 lg:grid-cols-[auto_minmax(0,1fr)]">
            <p className="reveal display-xl tabular-nums">
              <CountUp value={census_.gap} duration={700} />
              <span className="text-ink-3"> of {census_.assessed}</span>
            </p>
            <div className="reveal max-w-[34ch]">
              <p className="lede">
                languages we checked have no recordings of everyday requests in the speech datasets we reviewed.
              </p>
              <p className="mt-4 text-[15px] text-ink-3">A gap in testing material, not proof that AI fails them.</p>
              <Link to="/community" className="group mt-8 inline-flex items-center gap-2 text-[16px] font-semibold">
                See who, and where
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
              </Link>
            </div>
          </div>
        </Chapter>
      )}

      {/* 4. One sentence, two versions */}
      <Chapter tone="wash" size="l" label="An example">
        <p className="reveal display-m max-w-[16ch]">One sentence. Two versions.</p>
        <div className="reveal mt-14 rounded-2xl bg-paper p-6 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_12px_40px_-12px_rgb(0_0_0/0.12)] sm:p-12">
          {trans.status === 'loading' ? (
            <Skeleton className="h-28" />
          ) : specimen ? (
            <>
              <div className="draw">
                <ProofLines tokens={specimen.tokens} size="lg" />
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-5">
                <DiffLegend />
                <span className="text-[13px] text-ink-3">
                  {titleCase(specimen.t.language)}
                  {trans.isSample && <Flag kind="S" />}
                </span>
              </div>
            </>
          ) : (
            <p className="text-ink-2">An example appears here once transcripts are published.</p>
          )}
        </div>
      </Chapter>

      {/* 5. How well it listens */}
      <Chapter size="xl" label="Results by language">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 className="reveal display-l max-w-[12ch]">How well does it listen?</h2>
          <p className="reveal max-w-[30ch] text-[15px] text-ink-3">
            Share of words the AI got wrong, language detected automatically. Shorter is better.
          </p>
        </div>
        {langs.status === 'loading' ? (
          <Skeleton className="mt-16 h-72" />
        ) : ranked.length ? (
          <>
            <ol className="mt-16 space-y-5 sm:mt-20">
              {ranked.map((r) => (
                <li key={r.language_code} className="reveal grid grid-cols-[6.5rem_minmax(0,1fr)_5.5rem] items-center gap-4 sm:grid-cols-[9rem_minmax(0,1fr)_7rem] sm:gap-8">
                  <span className="text-[17px] font-medium sm:text-[20px]">{titleCase(r.language)}</span>
                  <span className="h-3 rounded-full bg-wash sm:h-4" aria-hidden>
                    <span className="grow-x-view block h-full rounded-full bg-proof" style={{ width: `${((r.wer ?? 0) / maxWer) * 100}%` }} />
                  </span>
                  <span className="text-right text-[22px] font-semibold tracking-[-0.02em] tabular-nums sm:text-[28px]">
                    {rate(r.wer, r.wer !== null && r.wer < 0.1 ? 1 : 0)}
                    {S}
                  </span>
                </li>
              ))}
            </ol>
            <p className="mt-10 max-w-[64ch] text-[14px] leading-relaxed text-ink-3">
              {ranked[0]?.clips_tested ? `${ranked[0].clips_tested} read-speech clips per language, so treat these as early signals. ` : ''}
              {cerOnly.length > 0 && `${cerOnly.join(' and ')} ${cerOnly.length > 1 ? 'are' : 'is'} written without spaces, so ${cerOnly.length > 1 ? 'they are' : 'it is'} measured by characters on the speech page.`}
            </p>
            <Link to="/speech" className="group mt-6 inline-flex items-center gap-2 text-[16px] font-semibold">
              Open the speech results
              <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
            </Link>
          </>
        ) : (
          <p className="mt-10 text-ink-2">Results appear here once the analysis is published.</p>
        )}
      </Chapter>

      {/* 6. How it works */}
      <Chapter tone="ink" size="l" id="method" label="How it works">
        <h2 className="reveal display-m">How it works</h2>
        <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="reveal lift rounded-2xl p-4 -m-4">
              <span className="display-l block text-white/25 tabular-nums">{i + 1}</span>
              <p className="mt-4 text-[19px] font-semibold">{s.title}</p>
              <p className="mt-2 text-[15px] leading-relaxed text-white/60">{s.body}</p>
            </li>
          ))}
        </ol>
      </Chapter>

      {/* 7. Invitation */}
      <Chapter size="xl" label="Try it">
        <div className="reveal flex flex-col items-start gap-10 sm:flex-row sm:items-end sm:justify-between">
          <p className="display-l max-w-[11ch]">Hear yourself through AI.</p>
          <Link to="/voice" className="inline-flex h-14 items-center gap-2.5 rounded-full bg-ink px-8 text-[16px] font-medium text-paper transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98]">
            <Mic className="h-5 w-5" aria-hidden /> Try your voice
          </Link>
        </div>
      </Chapter>

      <Container className="pb-20">
        <div className="border-t border-ink">
          <Disclosure title="About the data" summary="Sources, sample data and how figures are calculated.">
            <Notes
              flags={flags}
              sources={[
                { label: 'Speech results', value: <><Code>language_results.json</Code>, analysis team</> },
                { label: 'Transcripts', value: <><Code>transcription_results.json</Code>, ElevenLabs Scribe output</> },
                {
                  label: 'Census',
                  value: census.data.length ? (
                    <>
                      Adapted from Statistics Canada, 2021 Census, City of Mississauga by-ward table, under the{' '}
                      <a href="https://www.statcan.gc.ca/en/terms-conditions/open-licence" target="_blank" rel="noopener noreferrer" className="underline">
                        Statistics Canada Open Licence
                      </a>
                      . Full attribution on the Community page.
                    </>
                  ) : (
                    'Pending from the research team'
                  ),
                },
              ]}
            >
              Error rate (WER) is the share of words transcribed wrongly, compared with what was actually said.
            </Notes>
          </Disclosure>
        </div>
      </Container>
    </>
  )
}

const STEPS = [
  { title: 'Record', body: 'People speak in their own language.' },
  { title: 'Transcribe', body: 'ElevenLabs Scribe writes down what it heard.' },
  { title: 'Compare', body: 'We count every word it got wrong.' },
  { title: 'Map', body: 'Census data shows where each community lives.' },
]
