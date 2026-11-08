import { Users } from 'lucide-react'
import { useMemo, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CoverageGrid } from '../components/community/CoverageGrid'
import { DeepDive } from '../components/community/DeepDive'
import { Discovery } from '../components/community/Discovery'
import { LanguageExplorer } from '../components/community/LanguageExplorer'
import { SourceAttribution } from '../components/community/SourceAttribution'
import { DataIssues } from '../components/DataIssues'
import { Code, EmptyState, Skeleton } from '../components/EmptyState'
import { Section } from '../components/Section'
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
 * Community Intelligence, told as a story:
 * the discovery, one language at a time, where its speakers live,
 * what speech-AI testing covers, what is unknown, and the full detail on request.
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
    <div className="space-y-20 sm:space-y-28">
      <div className="space-y-10 sm:space-y-12">
      <header className="max-w-[62ch]">
        <h1 className="text-[2.25rem] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[2.75rem]">Who’s unheard, and where?</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-ink-2">
          Which languages Mississauga speaks at home, where those communities live, and whether speech AI has ever been
          tested on them.
        </p>
      </header>

      <DataIssues
        datasets={[
          { label: 'Citywide language ranking', file: 'census_citywide_languages.json', ds: city },
          { label: 'Ward language profile', file: 'census_ward_languages.json', ds: wards },
          { label: 'Speech dataset coverage', file: 'speech_dataset_coverage.json', ds: coverage },
        ]}
      />

      {loading ? (
        <div className="space-y-6">
          <Skeleton className="h-28 max-w-3xl" />
          <Skeleton className="h-16" />
        </div>
      ) : !selected ? (
        <EmptyState icon={Users} title="No census data yet">
          Run <Code>npm run data:census</Code> to generate the census files.
        </EmptyState>
      ) : (
        model.assessed.length > 0 && <Discovery model={model} onSelect={(l) => select(l, true)} />
      )}
      </div>

      {!loading && selected && (
        <>

          <div id="explore" className="scroll-mt-24">
            <Section
              title="Explore one language at a time"
              description="Pick a language to see how many people speak it at home, where they live, and what speech-AI testing exists for it."
            >
              <LanguageExplorer model={model} selected={selected} onSelect={(l) => select(l)} />
            </Section>
          </div>

          {model.assessed.length > 0 && (
            <Section
              title="What speech-AI testing covers"
              description="A filled dot means test recordings exist for that language. Service requests, like a banking call or a voice-assistant command, are the closest match to how residents use public services."
            >
              <CoverageGrid model={model} selected={selected} onSelect={(l) => select(l, true)} />
            </Section>
          )}

          <Section title="What we don’t know yet">
            <ul className="grid gap-x-12 gap-y-8 sm:grid-cols-2">
              <Unknown title="How well voice AI understands these languages">
                Accuracy tests are still running. Results will appear in each language’s story when they are published.
              </Unknown>
              <Unknown title="Who would rely on their home language">
                The census records languages spoken at home, not whether someone also speaks English or French.
              </Unknown>
              <Unknown title="Exact numbers of people">
                Totals that add languages together can count the same person twice, so they are not head counts.
              </Unknown>
              {w10Zeros.length > 0 ? (
                <Unknown title="Part of Ward 10">
                  Ward 10 was corrected in this release, but it still reports zero speakers of {w10Zeros.join(', ')}. Those
                  zeros are unconfirmed.
                </Unknown>
              ) : (
                <Unknown title="Exact ward boundaries">
                  Boundary files were not supplied, so wards are shown as circles rather than on a map.
                </Unknown>
              )}
            </ul>
          </Section>

          <Section title="Go deeper" description="The full tables, method and data checks, for anyone who wants to verify the story.">
            <DeepDive model={model} checks={checks.data[0]} selected={selected} onSelect={(l) => select(l, true)} />
          </Section>

          <SourceAttribution />
        </>
      )}
    </div>
  )
}

function Unknown({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="max-w-[52ch]">
      <p className="text-[17px] font-semibold tracking-[-0.01em]">{title}</p>
      <p className="mt-1.5 leading-relaxed text-ink-2">{children}</p>
    </li>
  )
}
