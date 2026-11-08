import { Users } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DeepDive } from '../components/community/DeepDive'
import { Discovery } from '../components/community/Discovery'
import { LanguageExplorer } from '../components/community/LanguageExplorer'
import { SourceAttribution } from '../components/community/SourceAttribution'
import { DataIssues } from '../components/DataIssues'
import { Code, EmptyState, Skeleton } from '../components/EmptyState'
import { LanguageCloud } from '../components/community/LanguageCloud'
import { Chapter, Container, Words } from '../components/story/Story'
import { useDataset } from '../hooks/useDataset'
import { buildModel, CAUTION_WARD } from '../lib/census'
import { langKey } from '../lib/language'
import {
  loadCensusChecks,
  loadCitywideLanguages,
  loadLanguageResults,
  loadSpeechCoverage,
  loadWardProfiles,
} from '../services/dataService'
import type { CitywideLanguage } from '../types/data'

/**
 * Community Intelligence as a story in chapters: the finding, one language at a time,
 * what is unknown, and the full detail on request.
 */
export function CommunityIntelligence() {
  const city = useDataset(loadCitywideLanguages)
  const wards = useDataset(loadWardProfiles)
  const coverage = useDataset(loadSpeechCoverage)
  const speech = useDataset(loadLanguageResults)
  const checks = useDataset(loadCensusChecks)

  const model = useMemo(
    () => buildModel(city.data, wards.data, coverage.data, speech.data, speech.isSample),
    [city.data, wards.data, coverage.data, speech.data, speech.isSample],
  )

  const [params, setParams] = useSearchParams()
  const selected = model.ranking.find((r) => langKey(r.language) === params.get('lang')) ?? model.ranking[0]

  const select = (lang: CitywideLanguage, scroll = false) => {
    setParams({ lang: langKey(lang.language) }, { replace: true, preventScrollReset: true })
    if (scroll) document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const loading = city.status === 'loading' || wards.status === 'loading' || coverage.status === 'loading'
  const w10 = model.wards.find((w) => w.ward === CAUTION_WARD)
  const w10Zeros = w10 ? Object.entries(w10.home_speakers).filter(([, n]) => n === 0).map(([l]) => l) : []

  return (
    <>
      <Chapter size="l" label="Introduction">
        <div className="grid items-center gap-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div>
            <h1 className="text-[clamp(2.5rem,5vw,4.25rem)] leading-[1] font-semibold tracking-[-0.04em]">
              <Words text="Who’s unheard," />
              <br />
              <Words text="and where?" offset={2} />
            </h1>
            <p className="lede mt-6 max-w-[30ch] text-ink-2">Mississauga’s languages, where they live, and which ones speech datasets leave out.</p>
          </div>
          {!loading && model.ranking.length > 0 && <LanguageCloud model={model} onSelect={(l) => select(l, true)} />}
        </div>
      </Chapter>

      <Container>
        <DataIssues
          datasets={[
            { label: 'Citywide language ranking', file: 'census_citywide_languages.json', ds: city },
            { label: 'Ward language profile', file: 'census_ward_languages.json', ds: wards },
            { label: 'Speech dataset coverage', file: 'speech_dataset_coverage.json', ds: coverage },
          ]}
        />
      </Container>

      {loading ? (
        <Container className="space-y-6 py-16">
          <Skeleton className="h-28 max-w-3xl" />
          <Skeleton className="h-24" />
        </Container>
      ) : !selected ? (
        <Container className="py-16">
          <EmptyState icon={Users} title="No census data yet">
            Run <Code>npm run data:census</Code> to generate the census files.
          </EmptyState>
        </Container>
      ) : (
        <>
          {model.assessed.length > 0 && (
            <Chapter size="m" className="pt-4 sm:pt-8" label="The finding">
              <Discovery model={model} onSelect={(l) => select(l, true)} />
            </Chapter>
          )}

          <Chapter tone="wash" size="l" id="explore" label="Explore a language">
            <h2 className="reveal display-m mb-14 max-w-[16ch] sm:mb-20">One language at a time.</h2>
            <LanguageExplorer model={model} selected={selected} onSelect={(l) => select(l)} />
          </Chapter>

          <Chapter tone="ink" size="l" label="What we don't know yet">
            <h2 className="reveal display-m max-w-[14ch]">What we don’t know yet.</h2>
            <ul className="mt-14 grid gap-x-14 gap-y-12 sm:grid-cols-2">
              <Unknown title="How well AI understands them">Accuracy tests are still running.</Unknown>
              <Unknown title="Who relies on their home language">The census doesn’t say who also speaks English.</Unknown>
              <Unknown title="Exact head counts">Adding languages can count one person twice.</Unknown>
              {w10Zeros.length > 0 ? (
                <Unknown title="Part of Ward 10">
                  Zero speakers of {w10Zeros.join(', ')} there is unconfirmed.
                </Unknown>
              ) : (
                <Unknown title="Exact ward boundaries">No boundary files were supplied, so there is no map.</Unknown>
              )}
            </ul>
          </Chapter>

          <Container className="pt-20 pb-16 sm:pt-28">
            <h2 className="display-m">Go deeper</h2>
            <p className="mt-3 text-[15px] text-ink-3">Full tables, method and data checks.</p>
            <div className="mt-10">
              <DeepDive model={model} checks={checks.data[0]} selected={selected} onSelect={(l) => select(l, true)} />
            </div>
          </Container>

          <Container className="pb-20">
            <SourceAttribution />
          </Container>
        </>
      )}
    </>
  )
}

function Unknown({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="reveal max-w-[40ch] border-t border-white/15 pt-5">
      <p className="text-[20px] font-semibold tracking-[-0.015em]">{title}</p>
      <p className="mt-2 text-[16px] leading-relaxed text-white/60">{children}</p>
    </li>
  )
}
