import type { CensusModel } from '../../lib/census'
import { int } from '../../lib/format'
import type { CitywideLanguage } from '../../types/data'
import { AnimatedNumber } from './AnimatedNumber'

const listNames = (names: string[]) =>
  names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`

/**
 * The answer, first: how many checked languages lack service-request recordings,
 * drawn as one proportional bar of home-speaker counts.
 */
export function Discovery({ model, onSelect }: { model: CensusModel; onSelect: (l: CitywideLanguage) => void }) {
  const { uncovered, covered, assessed, notAssessed, uncoveredCountSum } = model
  const total = assessed.reduce((n, r) => n + r.home_speakers, 0)
  const segments = [...uncovered, ...covered]

  return (
    <section aria-labelledby="discovery-h" className="space-y-8">
      <h2 id="discovery-h" className="max-w-[32ch] text-[1.75rem] leading-[1.15] font-semibold tracking-[-0.025em] sm:text-[2.25rem]">
        <span className="tabular-nums">{uncovered.length}</span> of the {assessed.length} languages we checked have no
        recorded service requests to test voice AI with.
      </h2>

      <figure>
        <div className="flex h-14 gap-[2px] sm:h-16" role="list" aria-label="Home-speaker counts of the languages we checked">
          {segments.map((r, i) => {
            const missing = i < uncovered.length
            const w = (r.home_speakers / total) * 100
            return (
              <button
                key={r.language}
                type="button"
                role="listitem"
                onClick={() => onSelect(r)}
                title={`${r.language}: ${int(r.home_speakers)} home speakers. ${missing ? 'No' : 'Has'} service-request recordings.`}
                aria-label={`${r.language}, ${int(r.home_speakers)} home speakers, ${missing ? 'no' : 'has'} service-request recordings. Explore.`}
                style={{ width: `${w}%`, ['--i' as string]: i }}
                className={`grow-x group relative min-w-[3px] overflow-hidden text-left transition-[filter] duration-150 hover:brightness-[1.35] focus-visible:z-10 ${
                  missing ? 'bg-ink text-paper' : 'bg-rule-2 text-ink'
                } ${i === 0 ? 'rounded-l-md' : ''} ${i === segments.length - 1 ? 'rounded-r-md' : ''}`}
              >
                {w > 6.5 && (
                  <span className="absolute bottom-2 left-2 hidden text-[12px] leading-none font-medium sm:block">{r.language}</span>
                )}
              </button>
            )
          })}
        </div>
        <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-[13px] text-ink-2">
          <span className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-[2px] bg-ink" aria-hidden /> No service-request recordings ({uncovered.length})
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-3 w-3 rounded-[2px] bg-rule-2" aria-hidden /> Has recordings ({covered.length})
            </span>
          </span>
          <span className="text-ink-3">Width shows how many people speak each language at home. Select one to explore it.</span>
        </figcaption>
      </figure>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-16 gap-y-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <div className="max-w-[60ch] space-y-3 text-[17px] leading-relaxed text-ink-2">
          <p>
            <strong className="font-semibold text-ink">{listNames(uncovered.map((r) => r.language))}</strong> are spoken
            at home across Mississauga, but none of them appear in the banking-call or voice-assistant recordings used to
            test speech AI.
          </p>
          <p>
            Without those recordings, no one can measure how well voice AI handles these communities’ everyday
            requests. That is a gap in testing, not evidence that the AI fails them.
          </p>
        </div>
        <div className="border-t border-ink pt-4">
          <p className="text-[3rem] leading-none font-semibold tracking-[-0.03em]">
            <AnimatedNumber value={uncoveredCountSum} />
          </p>
          <p className="mt-2 text-[15px] text-ink-2">
            home-speaker counts across these {uncovered.length} languages, from the validated census ranking
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-ink-3">
            Counts are added across languages, so this is not a count of unique people: someone who speaks two of these
            languages at home is counted twice.
            {notAssessed.length > 0 &&
              ` ${notAssessed.length} other ranked languages (${listNames(notAssessed.map((r) => r.language))}) were not part of the dataset check.`}
          </p>
        </div>
      </div>
    </section>
  )
}
