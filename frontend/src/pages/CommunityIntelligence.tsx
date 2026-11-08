import { Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DeepDive } from '../components/community/DeepDive'
import { Discovery } from '../components/community/Discovery'
import { MapExplorer } from '../components/community/MapExplorer'
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
  loadUnheardIndex,
  loadWardShapes,
} from '../services/dataService'
import type { CitywideLanguage, UnheardIndex, WardShapes } from '../types/data'

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

  const [shapes, setShapes] = useState<WardShapes | null>(null)
  // undefined while loading, null if the index file is missing or invalid
  const [index, setIndex] = useState<UnheardIndex | null | undefined>(undefined)
  useEffect(() => {
    let live = true
    loadWardShapes().then((s) => {
      if (live) setShapes(s)
    })
    loadUnheardIndex().then((i) => {
      if (live) setIndex(i)
    })
    return () => {
      live = false
    }
  }, [])

  const [params, setParams] = useSearchParams()
  const langParam = params.get('lang')
  const selected = model.ranking.find((r) => langKey(r.language) === langParam) ?? model.ranking[0]
  // The map opens on the Unheard Index; choosing a language (here or elsewhere on the page) switches to it.
  const view = index && !langParam ? 'index' : 'language'

  const select = (lang: CitywideLanguage, scroll = false) => {
    setParams({ lang: langKey(lang.language) }, { replace: true, preventScrollReset: true })
    if (scroll) document.getElementById('explore')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const loading = city.status === 'loading' || wards.status === 'loading' || coverage.status === 'loading' || index === undefined
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
          <Chapter tone="ink" size="l" id="explore" label="Ward map" className="map-atmosphere overflow-hidden">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
              {view === 'index' ? (
                <h2 key="index" className="reveal display-m swap-in max-w-[18ch]">
                  The <span className="text-[rgb(176_228_255)]">Unheard</span> Index.
                </h2>
              ) : (
                <h2 key="language" className="reveal display-m max-w-[18ch]">
                  Where <span key={selected.language} className="swap-in inline-block text-[rgb(176_228_255)]">{selected.language}</span> speakers
                  live.
                </h2>
              )}
              <p className="max-w-[30ch] text-[14px] leading-relaxed text-white/45">
                {view === 'index'
                  ? 'Which wards to prioritise for speech-AI accessibility. Choose a ward, or a language to see where it is spoken.'
                  : 'Choose a language, then a ward. City of Mississauga ward boundaries, 2021 census.'}
              </p>
            </div>
            <MapExplorer
              model={model}
              shapes={shapes}
              index={index ?? null}
              view={view}
              selected={selected}
              onSelect={(l) => select(l)}
              onIndex={() => setParams({}, { replace: true, preventScrollReset: true })}
            />
          </Chapter>

          {model.assessed.length > 0 && (
            <Chapter size="l" label="The finding">
              <Discovery model={model} onSelect={(l) => select(l, true)} />
            </Chapter>
          )}

          <Chapter tone="ink" size="l" label="What we don't know yet">
            <h2 className="reveal display-m max-w-[14ch]">What we don’t know yet.</h2>
            <ul className="mt-14 grid gap-x-14 gap-y-12 sm:grid-cols-2">
              <Unknown title="How AI handles real requests">Results so far use a few read-aloud clips per language, not real service calls.</Unknown>
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
