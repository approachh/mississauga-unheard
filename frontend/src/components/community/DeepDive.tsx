import type { ReactNode } from 'react'
import { isCaution, shareOfWard, WARD10_PREVIOUS_ZEROS, CAUTION_WARD, type CensusModel } from '../../lib/census'
import { int, pct } from '../../lib/format'
import { langKey } from '../../lib/language'
import type { CensusChecks, CitywideLanguage } from '../../types/data'
import { Code } from '../EmptyState'
import { Flag } from '../Flag'
import { Notes } from '../Notes'
import { Disclosure } from './Disclosure'

/** Everything a careful reader may want, one click away and closed by default. */
export function DeepDive({
  model,
  checks,
  selected,
  onSelect,
}: {
  model: CensusModel
  checks?: CensusChecks
  selected: CitywideLanguage
  onSelect: (l: CitywideLanguage) => void
}) {
  return (
    <div className="border-t border-ink">
      <Disclosure title="Every ward, every language" summary={`The full table: ${model.wardName.size} languages across 11 wards.`}>
        <WardMatrix model={model} selected={selected} onSelect={onSelect} />
      </Disclosure>
      <Disclosure title="Where the testing gap sits, ward by ward" summary="Home-speaker counts of languages without service-request recordings.">
        <GapTable model={model} />
      </Disclosure>
      <Disclosure title="Test recordings in numbers" summary="Clip, speaker and request counts behind the coverage dots.">
        <CoverageTable model={model} />
      </Disclosure>
      <Disclosure title="How we did this, and its limits" summary="Definitions, assumptions and what the data cannot show.">
        <Methodology model={model} />
      </Disclosure>
      <Disclosure title="Sources and data checks" summary="Where every number comes from, and how the files were verified.">
        <Sources model={model} checks={checks} />
      </Disclosure>
    </div>
  )
}

function WardMatrix({ model, selected, onSelect }: { model: CensusModel; selected: CitywideLanguage; onSelect: (l: CitywideLanguage) => void }) {
  const rows = model.ranking.filter((r) => model.wardName.has(langKey(r.language)))
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] border-collapse text-[13px]">
        <caption className="sr-only">Home speakers by language and ward</caption>
        <thead>
          <tr className="border-b border-ink align-bottom">
            <th scope="col" className="sticky left-0 z-10 bg-paper py-2 pr-3 text-left font-medium text-ink-3">
              Language
            </th>
            {model.wards.map((w) => (
              <th key={w.ward} scope="col" className="px-1.5 py-2 text-right font-medium text-ink-2">
                Ward {w.ward}
                {w.corrected && <span className="block text-[11px] font-normal text-ink-3">corrected</span>}
              </th>
            ))}
            <th scope="col" className="py-2 pl-3 text-right font-medium text-ink-3">
              Citywide
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const name = model.wardName.get(langKey(r.language))!
            const on = r.language === selected.language
            const sum = model.wards.reduce((n, w) => n + (w.home_speakers[name] ?? 0), 0)
            return (
              <tr key={r.language} className={`border-b border-paper ${on ? 'outline outline-1 -outline-offset-1 outline-ink' : ''}`}>
                <th scope="row" className="sticky left-0 z-10 bg-paper py-1.5 pr-3 text-left font-normal">
                  <button type="button" onClick={() => onSelect(r)} className={`rounded-sm text-left hover:underline ${on ? 'font-semibold' : 'text-ink-2'}`}>
                    {r.language}
                  </button>
                </th>
                {model.wards.map((w) => {
                  const n = w.home_speakers[name] ?? 0
                  const alpha = Math.min(0.85, (n / (sum || 1)) * 2.4)
                  return (
                    <td
                      key={w.ward}
                      className="px-1.5 py-1.5 text-right tabular-nums"
                      style={{ background: `rgb(11 11 12 / ${alpha.toFixed(3)})`, color: alpha > 0.42 ? '#fff' : undefined }}
                      title={`Ward ${w.ward}: ${int(n)}, ${pct(shareOfWard(n, w))} of ward residents`}
                    >
                      {int(n)}
                      {isCaution(w.ward, n) && <Flag kind="E" />}
                    </td>
                  )
                })}
                <td className="py-1.5 pl-3 text-right font-semibold tabular-nums">{int(r.home_speakers)}</td>
              </tr>
            )
          })}
          <tr className="border-t border-ink">
            <th scope="row" className="sticky left-0 z-10 bg-paper py-2 pr-3 text-left font-semibold">
              Residents
            </th>
            {model.wards.map((w) => (
              <td key={w.ward} className="px-1.5 py-2 text-right text-ink-2 tabular-nums">
                {int(w.population_language_base)}
              </td>
            ))}
            <td className="py-2 pl-3 text-right font-semibold tabular-nums">{int(model.wards.reduce((n, w) => n + w.population_language_base, 0))}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3 text-[13px] text-ink-3">
        Darker cells hold a larger share of the city’s speakers of that language. Residents is each ward’s
        language-base population, the denominator for every percentage on this page.
      </p>
    </div>
  )
}

function GapTable({ model }: { model: CensusModel }) {
  const names = model.uncovered.map((r) => model.wardName.get(langKey(r.language))).filter((n): n is string => !!n)
  const rows = model.wards
    .map((w) => {
      const parts = names.map((name) => ({ name, n: w.home_speakers[name] ?? 0 }))
      const total = parts.reduce((s, p) => s + p.n, 0)
      return {
        ward: w.ward,
        total,
        share: shareOfWard(total, w),
        largest: [...parts].sort((a, b) => b.n - a.n)[0],
        caution: parts.some((p) => isCaution(w.ward, p.n)),
      }
    })
    .sort((a, b) => b.total - a.total)
  const max = Math.max(1, ...rows.map((r) => r.total))

  return (
    <>
      <ol className="space-y-2.5">
        {rows.map((r) => (
          <li key={r.ward} className="grid grid-cols-[72px_minmax(0,1fr)_64px] items-center gap-x-4 text-[14px] sm:grid-cols-[72px_minmax(0,1fr)_64px_56px_160px]">
            <span className="font-medium">
              Ward {r.ward}
              {r.caution && <Flag kind="E" />}
            </span>
            <span className="h-2.5 rounded-sm bg-wash" aria-hidden>
              <span className="block h-full rounded-sm bg-ink" style={{ width: `${(r.total / max) * 100}%` }} />
            </span>
            <span className="text-right font-semibold tabular-nums">{int(r.total)}</span>
            <span className="hidden text-right text-ink-3 tabular-nums sm:block">{pct(r.share)}</span>
            <span className="hidden truncate text-ink-2 sm:block">
              mostly {r.largest.name} <span className="text-ink-3">{int(r.largest.n)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="mt-4 max-w-[70ch] text-[13px] leading-relaxed text-ink-3">
        Languages counted: {names.join(', ')}. Counts are added across languages, so they are not unique people, and the
        percentage is an upper bound of each ward’s language-base population.
      </p>
    </>
  )
}

function CoverageTable({ model }: { model: CensusModel }) {
  const cell = (n: number, unit: string) => (n ? `${int(n)} ${unit}` : <span className="text-ink-3">None</span>)
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-[14px]">
        <caption className="sr-only">Speech dataset counts per language</caption>
        <thead className="border-b border-ink text-left text-[13px] text-ink-3">
          <tr>
            {['Language', 'FLEURS', 'Speech Accent Archive', 'MINDS-14', 'Speech-MASSIVE', 'Team flag'].map((h) => (
              <th key={h} scope="col" className="py-2.5 pr-4 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.assessed.map((r) => {
            const c = model.coverageBy.get(langKey(r.language))!
            return (
              <tr key={r.language} className="border-b border-rule">
                <th scope="row" className="py-2.5 pr-4 text-left font-medium">
                  {r.language}
                </th>
                <td className="py-2.5 pr-4">{cell(c.fleurs_clips, 'clips')}</td>
                <td className="py-2.5 pr-4">{cell(c.accent_archive_speakers, 'speakers')}</td>
                <td className="py-2.5 pr-4">{cell(c.minds14_calls, 'calls')}</td>
                <td className="py-2.5 pr-4">{cell(c.speech_massive_commands, 'commands')}</td>
                <td className="py-2.5 pr-4 text-ink-2">
                  {c.limited_speech_coverage === undefined ? 'n/a' : c.limited_speech_coverage ? 'Limited coverage' : 'Not limited'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="mt-3 max-w-[70ch] text-[13px] leading-relaxed text-ink-3">
        FLEURS is read speech in the language. The Speech Accent Archive is English read by native speakers, so it tests
        accents, not the language. MINDS-14 (banking calls) and Speech-MASSIVE (assistant commands) are the
        service-request sets. “Team flag” is the census team’s limited-coverage marker; its criterion is not stated in the
        file. English is also covered but has no census count, so it is not shown.
      </p>
    </div>
  )
}

function Methodology({ model }: { model: CensusModel }) {
  const w10 = model.wards.find((w) => w.ward === CAUTION_WARD)
  const w10Zeros = w10 ? Object.entries(w10.home_speakers).filter(([, n]) => n === 0).map(([l]) => l) : []
  const resolved = w10 ? WARD10_PREVIOUS_ZEROS.filter((l) => (w10.home_speakers[l] ?? 0) > 0) : []
  const noWard = model.ranking.filter((r) => !model.wardName.has(langKey(r.language))).map((r) => r.language)

  const items: { title: string; body: ReactNode }[] = [
    {
      title: 'What “home speakers” means',
      body: 'People who speak a language at home, as reported in the census. It does not measure English or French ability, so it does not show who would rely on their home language with a voice service.',
    },
    {
      title: 'How percentages are calculated',
      body: 'Home speakers divided by the ward’s language-base population, as defined in the census Data Dictionary.',
    },
    {
      title: 'Counts are not unique people',
      body: 'Totals that add several languages count someone who speaks two of them twice. They are sums of language categories, not head counts.',
    },
    {
      title: 'Missing recordings mean a testing gap',
      body: 'Without service-request recordings, no one can measure how voice AI handles those requests. It is not evidence that ElevenLabs or any model performs poorly in that language.',
    },
    {
      title: 'Error rates measure words, not people',
      body: 'Word Error Rate is the share of words transcribed wrongly. It is not the share of residents affected. No rates are shown until the speech analysis is published.',
    },
  ]
  if (w10?.corrected || w10Zeros.length)
    items.push({
      title: 'Ward 10',
      body: (
        <>
          {w10?.corrected && (
            <>
              The City’s published table reports implausibly low Ward 10 home-language counts (for example, Urdu 50
              against 7,225 Urdu mother-tongue speakers). The VOXELO census team replaced them with corrected values
              {resolved.length ? `, so earlier zeros for ${resolved.join(', ')} no longer appear` : ''}. These corrected
              values are the team’s adjustment, not published Statistics Canada figures.{' '}
            </>
          )}
          {w10Zeros.length > 0 && (
            <>
              It still reports zero speakers of {w10Zeros.join(', ')} although every other ward reports some. These are
              flagged <Flag kind="E" /> and should not be read as proof that nobody there speaks them.
            </>
          )}
        </>
      ),
    })
  if (noWard.length)
    items.push({ title: 'Languages without ward detail', body: `${noWard.join(', ')}: citywide counts only. Their ward distribution is unknown, not zero.` })
  items.push(
    {
      title: 'Totals agree by construction',
      body: 'Citywide counts equal the sum of the 11 ward counts, so the files agree with each other. That is a consistency check, not validation against an independent source.',
    },
    { title: 'No map', body: 'Ward boundary files were not supplied, so wards are shown as circles rather than drawn on a map.' },
  )

  return (
    <dl className="grid gap-x-12 gap-y-5 md:grid-cols-2">
      {items.map((it) => (
        <div key={it.title} className="max-w-[62ch] border-t border-rule pt-3 text-[14px] leading-relaxed">
          <dt className="font-semibold">{it.title}</dt>
          <dd className="mt-1 text-ink-2">{it.body}</dd>
        </div>
      ))}
    </dl>
  )
}

function Sources({ model, checks }: { model: CensusModel; checks?: CensusChecks }) {
  const disagreements = checks?.notes.filter((n) => !n.includes('zero home speakers')) ?? []
  const reconciled = model.ranking.filter((r) => {
    const name = model.wardName.get(langKey(r.language))
    return name && model.wards.reduce((n, w) => n + (w.home_speakers[name] ?? 0), 0) === r.home_speakers
  }).length
  const flags = model.wards.some((w) => Object.values(w.home_speakers).some((v) => isCaution(w.ward, v))) ? (['E'] as const) : []

  return (
    <Notes
      flags={[...flags]}
      sources={[
        { label: 'Census', value: 'Statistics Canada 2021 Census, City of Mississauga by-ward table (see Census source below)' },
        { label: 'Citywide', value: <><Code>citywide_language_ranking_VALIDATED.csv</Code>, census team (sum of wards)</> },
        { label: 'Wards', value: <><Code>ward_language_profile_2021_VALIDATED.csv</Code>, census team (Ward 10 adjusted)</> },
        { label: 'Coverage', value: <><Code>language_coverage_validated.csv</Code>, dataset columns only</> },
        { label: 'Cross-check', value: <><Code>census_summary.csv</Code>, used only to verify the files above</> },
        { label: 'Speech', value: <><Code>language_results.json</Code>, joined only once published</> },
      ]}
    >
      Converted with <Code>npm run data:census</Code>. “Mandarin Chinese” is treated as Mandarin. In the browser,{' '}
      {reconciled} of {model.wardName.size} languages’ ward counts add up exactly to their citywide figure.
      {checks && checks.summary_rows_checked > 0 && (
        <>
          {' '}
          At conversion ({checks.generated}), {int(checks.summary_rows_checked)} census-summary rows were checked
          {disagreements.length ? '. The checks reported:' : ' with no disagreements.'}
          {disagreements.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {disagreements.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
        </>
      )}
    </Notes>
  )
}
