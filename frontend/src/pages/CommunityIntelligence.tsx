import { Check, Minus, Users } from 'lucide-react'
import { useMemo, useRef, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DataIssues } from '../components/DataIssues'
import { Code, EmptyState, Skeleton } from '../components/EmptyState'
import { Flag } from '../components/Flag'
import { KeyFigure, KeyFigures } from '../components/KeyFigures'
import { Notes } from '../components/Notes'
import { PageTitle, Section } from '../components/Section'
import { WardChart, type WardDatum } from '../components/WardChart'
import { useDataset } from '../hooks/useDataset'
import type { FlagKind } from '../lib/flags'
import { int, pct } from '../lib/format'
import { langKey } from '../lib/language'
import {
  loadCitywideLanguages,
  loadLanguageResults,
  loadSpeechCoverage,
  loadWardProfiles,
} from '../services/dataService'
import type { CitywideLanguage, SpeechCoverage, WardProfile } from '../types/data'

/** Ward 10 reports zeros for several profiled languages; treat those zeros as unverified. */
const CAUTION_WARD = 10
const isCaution = (ward: number, value: number) => ward === CAUTION_WARD && value === 0

export function CommunityIntelligence() {
  const city = useDataset(loadCitywideLanguages)
  const wards = useDataset(loadWardProfiles)
  const coverage = useDataset(loadSpeechCoverage)
  const speech = useDataset(loadLanguageResults)

  const [params, setParams] = useSearchParams()
  const detailRef = useRef<HTMLDivElement>(null)

  const ranking = useMemo(() => [...city.data].sort((a, b) => a.rank - b.rank), [city.data])
  const wardRows = useMemo(() => [...wards.data].sort((a, b) => a.ward - b.ward), [wards.data])

  // Ward speaker counts keyed by language join key.
  const wardLanguages = useMemo(() => {
    const m = new Map<string, string>() // key -> name as used in ward file
    for (const w of wardRows) for (const name of Object.keys(w.home_speakers)) m.set(langKey(name), name)
    return m
  }, [wardRows])
  const coverageBy = useMemo(() => new Map(coverage.data.map((c) => [langKey(c.language), c])), [coverage.data])
  // Only published speech results are joined; sample placeholders never appear next to census data.
  const speechBy = useMemo(
    () => new Map(speech.isSample ? [] : speech.data.map((s) => [langKey(s.language), s])),
    [speech.data, speech.isSample],
  )

  const selectedKey = params.get('lang') ?? (ranking[0] ? langKey(ranking[0].language) : '')
  const selected = ranking.find((r) => langKey(r.language) === selectedKey) ?? ranking[0]

  const select = (lang: CitywideLanguage) => {
    setParams({ lang: langKey(lang.language) }, { replace: true, preventScrollReset: true })
    if (window.matchMedia('(max-width: 1023px)').matches) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // Service-request audio gap: assessed languages without it, using validated citywide counts.
  const uncovered = ranking.filter((r) => coverageBy.get(langKey(r.language))?.has_service_request_audio === false)
  const assessed = ranking.filter((r) => coverageBy.has(langKey(r.language)))
  const uncoveredSpeakers = uncovered.reduce((n, r) => n + r.home_speakers, 0)
  const uncoveredWardKeys = uncovered.map((r) => langKey(r.language)).filter((k) => wardLanguages.has(k))

  // Reconciliation: do the ward counts add up to the validated citywide figure?
  const reconciled = useMemo(() => {
    const mismatched: string[] = []
    let checked = 0
    for (const r of ranking) {
      const name = wardLanguages.get(langKey(r.language))
      if (!name) continue
      checked++
      if (wardRows.reduce((n, w) => n + (w.home_speakers[name] ?? 0), 0) !== r.home_speakers) mismatched.push(r.language)
    }
    return { checked, mismatched }
  }, [ranking, wardRows, wardLanguages])

  const loading = city.status === 'loading' || wards.status === 'loading' || coverage.status === 'loading'
  const flags: FlagKind[] = wardRows.some((w) => Object.values(w.home_speakers).some((v) => isCaution(w.ward, v))) ? ['E'] : []

  return (
    <div className="space-y-12 sm:space-y-16">
      <PageTitle
        title="Who’s unheard, and where?"
        lede="Research question 2. Which languages Mississauga residents speak at home, where those communities live across the 11 wards, and which languages public speech-evaluation datasets leave untested."
      />

      <DataIssues
        datasets={[
          { label: 'Citywide language ranking', file: 'census_citywide_languages.json', ds: city },
          { label: 'Ward language profile', file: 'census_ward_languages.json', ds: wards },
          { label: 'Speech dataset coverage', file: 'speech_dataset_coverage.json', ds: coverage },
        ]}
      />

      {loading ? (
        <Skeleton className="h-24" />
      ) : ranking.length > 0 ? (
        <KeyFigures>
          <KeyFigure label="Home languages ranked" value={int(ranking.length)} />
          <KeyFigure label={`Most spoken in the ranking · ${ranking[0].language}`} value={int(ranking[0].home_speakers)} />
          <KeyFigure
            label="Assessed languages without service-request audio"
            value={
              <>
                {uncovered.length}
                <span className="text-[17px] font-medium text-ink-3"> of {assessed.length}</span>
              </>
            }
          />
          <KeyFigure label="Home speakers of those languages" value={int(uncoveredSpeakers)} />
        </KeyFigures>
      ) : null}

      {/* Explorer */}
      <Section
        id="languages"
        title="Languages spoken at home"
        description="Validated citywide home-speaker counts. Select a language to see where its speakers live and which speech datasets include it."
      >
        {loading ? (
          <Skeleton className="h-96" />
        ) : !ranking.length ? (
          <EmptyState icon={Users} title="No census ranking yet">
            Run <Code>npm run data:census</Code> to generate <Code>census_citywide_languages.json</Code>.
          </EmptyState>
        ) : (
          <div className="grid items-start gap-x-12 gap-y-10 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <LanguageList ranking={ranking} selected={selected} onSelect={select} coverageBy={coverageBy} />
            <div ref={detailRef} className="scroll-mt-32 lg:sticky lg:top-24">
              {selected && (
                <LanguageDetail
                  lang={selected}
                  total={ranking.length}
                  wardRows={wardRows}
                  wardName={wardLanguages.get(langKey(selected.language))}
                  coverage={coverageBy.get(langKey(selected.language))}
                  speechResult={speechBy.get(langKey(selected.language))}
                  speechSample={speech.isSample}
                />
              )}
            </div>
          </div>
        )}
      </Section>

      {/* Service-request audio gap by ward */}
      {wardRows.length > 0 && uncoveredWardKeys.length > 0 && (
        <Section
          id="gaps"
          title="Where service-request audio is missing"
          description={
            <>
              Home speakers of profiled languages that have no service-request recordings (MINDS-14 or Speech-MASSIVE)
              in our evaluation datasets, by ward. This marks a gap in what we can test, not evidence that voice AI fails
              these speakers.
            </>
          }
        >
          <GapTable
            wardRows={wardRows}
            keys={uncoveredWardKeys}
            names={wardLanguages}
          />
        </Section>
      )}

      {/* Full ward profile */}
      {wardRows.length > 0 && (
        <Section
          id="wards"
          title="Ward profile"
          description="Home speakers of the 14 profiled languages in every ward. Shading shows each ward’s share of that language’s citywide speakers. Select a column to explore it above."
        >
          <WardMatrix
            wardRows={wardRows}
            ranking={ranking}
            names={wardLanguages}
            selectedKey={selected ? langKey(selected.language) : ''}
            onSelect={(lang) => {
              select(lang)
              document.getElementById('languages')?.scrollIntoView({ behavior: 'smooth' })
            }}
          />
        </Section>
      )}

      <Section id="limitations" title="What this data can and cannot tell us">
        <ol className="grid gap-x-10 gap-y-4 text-[14px] leading-relaxed text-ink-2 md:grid-cols-2">
          {LIMITATIONS.map((l, i) => (
            <li key={l.title} className="grid grid-cols-[22px_1fr] border-t border-rule-2 pt-3">
              <span className="font-semibold text-ink-3">{i + 1}</span>
              <div>
                <p className="font-semibold text-ink">{l.title}</p>
                <p className="mt-0.5 max-w-[62ch]">{l.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Notes
        flags={flags}
        sources={[
          { label: 'Citywide', value: <><Code>citywide_language_ranking_VALIDATED.csv</Code>, census team</> },
          { label: 'Wards', value: <><Code>ward_language_profile_2021_VALIDATED.csv</Code>, census team</> },
          { label: 'Coverage', value: <><Code>language_coverage_validated.csv</Code>, census team (dataset columns only)</> },
          { label: 'Speech', value: <><Code>language_results.json</Code>, joined only once published</> },
        ]}
      >
        CSVs are converted to JSON by <Code>npm run data:census</Code>. “Mandarin Chinese” in the coverage file is
        treated as Mandarin.{' '}
        {reconciled.checked > 0 &&
          (reconciled.mismatched.length === 0
            ? `For all ${reconciled.checked} profiled languages, the 11 ward counts add up exactly to the citywide figure. That shows the files agree; it does not confirm the Ward 10 zeros.`
            : `Ward counts do not add up to the citywide figure for: ${reconciled.mismatched.join(', ')}.`)}
      </Notes>
    </div>
  )
}

const LIMITATIONS = [
  {
    title: 'Home language is not English ability',
    body: 'Counts measure people who speak a language at home. Many of them also speak English or French; the data does not say who would rely on their home language with a voice service.',
  },
  {
    title: 'Ward 10 zeros are unverified',
    body: 'Ward 10 reports zero speakers for several large languages. These are flagged E and should not be read as proof that nobody there speaks them.',
  },
  {
    title: 'Ward detail covers 14 languages',
    body: 'Six ranked languages (for example Russian, Korean, Italian) have citywide counts only. Their ward distribution is unknown, not zero.',
  },
  {
    title: 'Missing audio is a testing gap',
    body: 'Where no service-request recordings exist, we cannot measure how voice AI handles that kind of request. It is not evidence that ElevenLabs cannot understand the language.',
  },
  {
    title: 'Accent Archive is English speech',
    body: 'Speech Accent Archive counts are speakers of the language reading an English passage. They test English accents, not recognition of the language itself.',
  },
  {
    title: 'No recognition scores yet',
    body: 'Word and Character Error Rates appear here only after the speech analysis team publishes results. No scores are estimated or carried over from sample data.',
  },
  {
    title: 'One population source',
    body: 'Population figures come only from the validated citywide ranking and ward profile. An older population column in the coverage file conflicts with validated counts and is not used.',
  },
  {
    title: 'No map yet',
    body: 'Ward boundaries have not been supplied, so wards are shown as a table and chart. A map can be added once boundary data is available.',
  },
]

function LanguageList({
  ranking,
  selected,
  onSelect,
  coverageBy,
}: {
  ranking: CitywideLanguage[]
  selected?: CitywideLanguage
  onSelect: (l: CitywideLanguage) => void
  coverageBy: Map<string, SpeechCoverage>
}) {
  const max = ranking[0]?.home_speakers ?? 1
  return (
    <div>
      <div className="grid grid-cols-[28px_minmax(0,1fr)_76px_64px] items-end gap-x-3 border-b border-ink pb-2 text-[13px] font-medium text-ink-3">
        <span>#</span>
        <span>Language</span>
        <span className="text-right">Home speakers</span>
        <span className="text-right" title="Service-request audio in evaluation datasets">
          Service audio
        </span>
      </div>
      <ul aria-label="Languages ranked by home speakers">
        {ranking.map((r) => {
          const key = langKey(r.language)
          const isSel = selected && langKey(selected.language) === key
          const cov = coverageBy.get(key)
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={!!isSel}
                onClick={() => onSelect(r)}
                className={`grid w-full grid-cols-[28px_minmax(0,1fr)_76px_64px] items-center gap-x-3 border-b border-rule py-2 text-left text-[14px] transition-colors duration-100 hover:bg-wash ${
                  isSel ? 'bg-wash' : ''
                }`}
              >
                <span className="text-ink-3">{r.rank}</span>
                <span className="min-w-0">
                  <span className={isSel ? 'font-semibold' : ''}>{r.language}</span>
                  <span className="mt-1 block h-1 bg-rule" aria-hidden>
                    <span className={`block h-full ${isSel ? 'bg-ink' : 'bg-ink-3'}`} style={{ width: `${(r.home_speakers / max) * 100}%` }} />
                  </span>
                </span>
                <span className="text-right font-medium">{int(r.home_speakers)}</span>
                <span className="flex justify-end text-[12px]">
                  <AudioStatus coverage={cov} />
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function AudioStatus({ coverage }: { coverage?: SpeechCoverage }) {
  if (!coverage) return <span className="text-ink-3">n/a</span>
  return coverage.has_service_request_audio ? (
    <span className="inline-flex items-center gap-1 text-ink">
      <Check className="h-3.5 w-3.5" aria-hidden /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-ink-3">
      <Minus className="h-3.5 w-3.5" aria-hidden /> None
    </span>
  )
}

function LanguageDetail({
  lang,
  total,
  wardRows,
  wardName,
  coverage,
  speechResult,
  speechSample,
}: {
  lang: CitywideLanguage
  total: number
  wardRows: WardProfile[]
  wardName?: string
  coverage?: SpeechCoverage
  speechResult?: { wer: number; cer: number; clips_tested: number }
  speechSample: boolean
}) {
  const wardData: WardDatum[] = wardName
    ? wardRows.map((w) => {
        const n = w.home_speakers[wardName] ?? 0
        return { ward: w.ward, speakers: n, shareOfWard: n / w.population_language_base, caution: isCaution(w.ward, n) }
      })
    : []
  const topWards = [...wardData].sort((a, b) => b.speakers - a.speakers).slice(0, 3)
  const wardSum = wardData.reduce((n, d) => n + d.speakers, 0)

  return (
    <article aria-live="polite" className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b border-rule pb-5">
        <div>
          <p className="text-[13px] text-ink-3">
            Rank {lang.rank} of {total}
          </p>
          <h3 className="text-[28px] leading-tight font-semibold tracking-[-0.025em]">{lang.language}</h3>
        </div>
        <p className="text-right">
          <span className="block text-[28px] leading-none font-semibold tracking-[-0.02em]">{int(lang.home_speakers)}</span>
          <span className="text-[13px] text-ink-3">home speakers citywide</span>
        </p>
      </header>

      <section aria-label="Distribution across wards">
        <h4 className="mb-3 font-semibold">Across the 11 wards</h4>
        {wardData.length ? (
          <div className="grid gap-x-8 gap-y-5 xl:grid-cols-[minmax(0,1fr)_220px]">
            <WardChart data={wardData} language={lang.language} />
            <div>
              <p className="mb-1 text-[13px] text-ink-3">Most home speakers</p>
              <ol className="divide-y divide-rule border-y border-rule text-[14px]">
                {topWards.map((d) => (
                  <li key={d.ward} className="flex items-baseline justify-between gap-3 py-2.5">
                    <span>
                      <span className="font-semibold">Ward {d.ward}</span>
                      <span className="block text-[12px] text-ink-3">
                        {wardSum ? pct(d.speakers / wardSum) : 'n/a'} of the city’s {lang.language} speakers
                      </span>
                    </span>
                    <span className="text-right font-semibold">
                      {int(d.speakers)}
                      <span className="block text-[12px] font-normal text-ink-3">{pct(d.shareOfWard)} of ward</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-rule-2 bg-wash px-4 py-3 text-[14px] text-ink-2">
            The ward profile covers 14 languages and does not include {lang.language}. Its distribution across wards is
            unknown, not zero.
          </p>
        )}
      </section>

      <section aria-label="Speech dataset coverage" className="grid gap-x-10 gap-y-8 md:grid-cols-2">
        <div>
          <h4 className="mb-1 font-semibold">Speech evaluation datasets</h4>
          {coverage ? (
            <>
              <dl className="divide-y divide-rule border-y border-rule text-[14px]">
                <CoverageRow name="FLEURS" what="read speech in the language" n={coverage.fleurs_clips} unit="clips" />
                <CoverageRow name="Speech Accent Archive" what="English read by native speakers" n={coverage.accent_archive_speakers} unit="speakers" />
                <CoverageRow name="MINDS-14" what="spoken banking requests" n={coverage.minds14_calls} unit="calls" service />
                <CoverageRow name="Speech-MASSIVE" what="spoken assistant commands" n={coverage.speech_massive_commands} unit="commands" service />
              </dl>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-2">
                {coverage.has_service_request_audio ? (
                  <>
                    <strong className="font-semibold text-ink">Service-request audio available.</strong> Requests like
                    the ones residents make to public services can be tested in {lang.language}.
                  </>
                ) : (
                  <>
                    <strong className="font-semibold text-ink">No service-request audio.</strong> We cannot yet test
                    service-style requests in {lang.language}. This is a gap in test material, not a finding about
                    recognition quality.
                  </>
                )}
              </p>
            </>
          ) : (
            <p className="mt-2 text-[14px] text-ink-2">
              {lang.language} was not part of the dataset coverage assessment, so its coverage is unknown.
            </p>
          )}
        </div>

        <div>
          <h4 className="mb-1 font-semibold">Recognition accuracy</h4>
          {speechResult ? (
            <dl className="divide-y divide-rule border-y border-rule text-[14px]">
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-2">Word Error Rate</dt>
                <dd className="font-semibold">{pct(speechResult.wer)}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-2">Character Error Rate</dt>
                <dd className="font-semibold">{pct(speechResult.cer)}</dd>
              </div>
              <div className="flex justify-between py-2.5">
                <dt className="text-ink-2">Clips tested</dt>
                <dd className="font-semibold">{int(speechResult.clips_tested)}</dd>
              </div>
            </dl>
          ) : (
            <div className="border-y border-rule py-3 text-[14px] text-ink-2">
              <p className="font-medium text-ink">Pending</p>
              <p className="mt-1">
                {speechSample
                  ? 'Speech analysis results have not been published yet. Error rates will appear here when they are.'
                  : `No published error rates for ${lang.language} yet.`}
              </p>
            </div>
          )}
        </div>
      </section>
    </article>
  )
}

function CoverageRow({ name, what, n, unit, service }: { name: string; what: string; n: number; unit: string; service?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt>
        <span className="font-medium">{name}</span>
        {service && <span className="ml-1.5 text-[11px] text-ink-3">service request</span>}
        <span className="block text-[12px] text-ink-3">{what}</span>
      </dt>
      <dd className={`shrink-0 text-right ${n ? 'font-semibold' : 'text-ink-3'}`}>{n ? `${int(n)} ${unit}` : 'None'}</dd>
    </div>
  )
}

function GapTable({ wardRows, keys, names }: { wardRows: WardProfile[]; keys: string[]; names: Map<string, string> }) {
  const rows = wardRows.map((w) => {
    const parts = keys.map((k) => ({ name: names.get(k)!, n: w.home_speakers[names.get(k)!] ?? 0 }))
    const total = parts.reduce((s, p) => s + p.n, 0)
    const largest = [...parts].sort((a, b) => b.n - a.n)[0]
    const caution = parts.some((p) => isCaution(w.ward, p.n))
    return { ward: w.ward, total, share: total / w.population_language_base, largest, caution }
  })
  const max = Math.max(1, ...rows.map((r) => r.total))
  const sorted = [...rows].sort((a, b) => b.total - a.total)

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[14px]">
        <caption className="sr-only">Home speakers of languages without service-request audio, by ward</caption>
        <thead className="border-b border-ink text-[13px] text-ink-3">
          <tr>
            <th scope="col" className="py-2.5 pr-4 text-left font-medium">Ward</th>
            <th scope="col" className="py-2.5 pl-4 text-right font-medium">Home speakers</th>
            <th scope="col" className="py-2.5 pl-4 text-right font-medium">Share of ward</th>
            <th scope="col" className="py-2.5 pl-6 text-left font-medium">Largest of these languages</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.ward} className="border-b border-rule">
              <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                Ward {r.ward}
                {r.caution && <Flag kind="E" />}
              </th>
              <td className="py-2.5 pl-4 text-right">
                <span className="flex items-center justify-end gap-3">
                  <span className="hidden h-2 w-full max-w-[200px] bg-wash sm:block" aria-hidden>
                    <span className="block h-full bg-ink" style={{ width: `${(r.total / max) * 100}%` }} />
                  </span>
                  <span className="w-14 shrink-0 font-medium">{int(r.total)}</span>
                </span>
              </td>
              <td className="py-2.5 pl-4 text-right">{pct(r.share)}</td>
              <td className="py-2.5 pl-6 text-ink-2">
                {r.largest.name} <span className="text-ink-3">{int(r.largest.n)}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-[12px] text-ink-3">
        Languages counted: {keys.map((k) => names.get(k)).join(', ')}. Share uses each ward’s language-base population.
      </p>
    </div>
  )
}

function WardMatrix({
  wardRows,
  ranking,
  names,
  selectedKey,
  onSelect,
}: {
  wardRows: WardProfile[]
  ranking: CitywideLanguage[]
  names: Map<string, string>
  selectedKey: string
  onSelect: (l: CitywideLanguage) => void
}) {
  // Columns in citywide rank order.
  const cols = ranking.filter((r) => names.has(langKey(r.language)))
  const colTotals = new Map(cols.map((c) => {
    const name = names.get(langKey(c.language))!
    return [name, wardRows.reduce((n, w) => n + (w.home_speakers[name] ?? 0), 0)]
  }))

  const cell = (w: WardProfile, name: string, isSel: boolean): ReactNode => {
    const n = w.home_speakers[name] ?? 0
    const share = n / (colTotals.get(name) || 1)
    const alpha = Math.min(0.85, share * 2.4)
    return (
      <td
        key={name}
        className={`px-2 py-2 text-right ${isSel ? 'outline outline-1 -outline-offset-1 outline-ink' : ''}`}
        style={{ background: `rgb(11 11 12 / ${alpha.toFixed(3)})`, color: alpha > 0.42 ? '#fff' : undefined }}
        title={`Ward ${w.ward}: ${int(n)} (${pct(share)} of citywide ${name} speakers)`}
      >
        {int(n)}
        {isCaution(w.ward, n) && <Flag kind="E" />}
      </td>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-[13px]">
        <caption className="sr-only">Home speakers by ward and language</caption>
        <thead>
          <tr className="border-b border-ink">
            <th scope="col" className="sticky left-0 z-10 bg-paper py-2 pr-3 text-left font-medium text-ink-3">Ward</th>
            <th scope="col" className="px-2 py-2 text-right font-medium text-ink-3">Residents</th>
            {cols.map((c) => {
              const isSel = langKey(c.language) === selectedKey
              return (
                <th key={c.language} scope="col" className="px-1 py-2 text-right align-bottom font-medium">
                  <button
                    type="button"
                    onClick={() => onSelect(c)}
                    aria-pressed={isSel}
                    className={`rounded-sm px-1 hover:underline ${isSel ? 'text-ink underline decoration-2 underline-offset-4' : 'text-ink-2'}`}
                  >
                    {c.language}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {wardRows.map((w) => (
            <tr key={w.ward} className="border-b border-paper">
              <th scope="row" className="sticky left-0 z-10 bg-paper py-2 pr-3 text-left font-medium">
                Ward {w.ward}
              </th>
              <td className="px-2 py-2 text-right text-ink-2">{int(w.population_language_base)}</td>
              {cols.map((c) => {
                const name = names.get(langKey(c.language))!
                return cell(w, name, langKey(c.language) === selectedKey)
              })}
            </tr>
          ))}
          <tr className="border-t border-ink">
            <th scope="row" className="sticky left-0 z-10 bg-paper py-2 pr-3 text-left font-semibold">
              Total
            </th>
            <td className="px-2 py-2 text-right font-semibold">{int(wardRows.reduce((n, w) => n + w.population_language_base, 0))}</td>
            {cols.map((c) => {
              const name = names.get(langKey(c.language))!
              const sum = colTotals.get(name) ?? 0
              return (
                <td key={c.language} className="px-2 py-2 text-right font-semibold" title={sum === c.home_speakers ? 'Matches the citywide ranking' : `Citywide ranking: ${int(c.home_speakers)}`}>
                  {int(sum)}
                </td>
              )
            })}
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[12px] text-ink-3">
        Residents is the ward’s language-base population. Darker cells hold a larger share of the city’s speakers of
        that language. Scroll sideways on small screens.
      </p>
    </div>
  )
}
