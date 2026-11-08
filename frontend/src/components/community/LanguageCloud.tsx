import type { CensusModel } from '../../lib/census'
import { int } from '../../lib/format'
import { langKey } from '../../lib/language'
import type { CitywideLanguage } from '../../types/data'

/**
 * Hero visual: every ranked language, sized by home speakers (area-true via sqrt), largest in
 * the centre. Ink = no service-request recordings in the reviewed datasets, grey = has them,
 * pale = not part of the dataset check. Words float in, then drift; each opens its story.
 */
export function LanguageCloud({ model, onSelect }: { model: CensusModel; onSelect: (l: CitywideLanguage) => void }) {
  const max = model.ranking[0]?.home_speakers ?? 1
  // Centre-out order: largest in the middle, alternating outward.
  const ordered: CitywideLanguage[] = []
  model.ranking.forEach((r, i) => (i % 2 ? ordered.push(r) : ordered.unshift(r)))

  const status = (r: CitywideLanguage) => {
    const c = model.coverageBy.get(langKey(r.language))
    return !c ? 'unchecked' : c.has_service_request_audio ? 'covered' : 'missing'
  }

  return (
    <figure>
      <ul className="flex flex-wrap items-baseline justify-center gap-x-5 gap-y-2 text-center" aria-label="Languages spoken at home, sized by number of speakers">
        {ordered.map((r, i) => {
          const s = status(r)
          const size = 14 + Math.sqrt(r.home_speakers / max) * 40
          return (
            <li key={r.language} className="cloud-word" style={{ ['--w' as string]: i }}>
              <button
                type="button"
                onClick={() => onSelect(r)}
                title={`${r.language}: ${int(r.home_speakers)} home speakers`}
                aria-label={`${r.language}, ${int(r.home_speakers)} home speakers, ${
                  s === 'missing' ? 'no service-request recordings' : s === 'covered' ? 'has service-request recordings' : 'not checked'
                }. Explore.`}
                style={{ fontSize: size }}
                className={`rounded-md leading-[1.15] tracking-[-0.02em] transition-[color,transform] duration-200 hover:-translate-y-0.5 hover:underline hover:decoration-2 hover:underline-offset-4 ${
                  s === 'missing' ? 'font-semibold text-ink' : s === 'covered' ? 'font-medium text-ink-3 hover:text-ink' : 'font-normal italic text-ink-3 hover:text-ink'
                }`}
              >
                {r.language}
              </button>
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-1 text-[13px] text-ink-3">
        <span>
          <strong className="font-semibold text-ink">Bold</strong> no recordings of everyday requests
        </span>
        <span>Grey has recordings</span>
        <span className="italic">Italic not checked</span>
      </figcaption>
    </figure>
  )
}
