import type { CensusModel } from '../../lib/census'
import { int } from '../../lib/format'
import { langKey } from '../../lib/language'
import type { CitywideLanguage, SpeechCoverage } from '../../types/data'

const COLUMNS: { key: keyof SpeechCoverage; label: string; source: string; unit: string }[] = [
  { key: 'fleurs_clips', label: 'Read speech', source: 'FLEURS', unit: 'clips' },
  { key: 'accent_archive_speakers', label: 'Accented English', source: 'Speech Accent Archive', unit: 'speakers' },
  { key: 'minds14_calls', label: 'Banking calls', source: 'MINDS-14', unit: 'calls' },
  { key: 'speech_massive_commands', label: 'Assistant commands', source: 'Speech-MASSIVE', unit: 'commands' },
]

/** Which test recordings exist for each checked language: a dot where data exists, a ring where it does not. */
export function CoverageGrid({
  model,
  selected,
  onSelect,
}: {
  model: CensusModel
  selected: CitywideLanguage
  onSelect: (l: CitywideLanguage) => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] border-collapse text-[14px]">
        <caption className="sr-only">Speech test recordings available per language</caption>
        <thead>
          <tr className="text-[12px] text-ink-3">
            <th scope="col" />
            <th scope="colgroup" colSpan={2} className="border-b border-rule-2 pb-1.5 text-center font-medium">
              General recognition
            </th>
            <th scope="colgroup" colSpan={2} className="border-b border-ink pb-1.5 text-center font-semibold text-ink">
              Service requests
            </th>
          </tr>
          <tr className="border-b border-ink align-bottom">
            <th scope="col" className="py-2.5 pr-4 text-left text-[13px] font-medium text-ink-3">
              Language
            </th>
            {COLUMNS.map((c) => (
              <th key={c.key} scope="col" className="w-[17%] px-2 py-2.5 text-center font-medium">
                <span className="block text-[13px] text-ink">{c.label}</span>
                <span className="block text-[11px] font-normal text-ink-3">{c.source}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {model.assessed.map((r) => {
            const cov = model.coverageBy.get(langKey(r.language))!
            const on = r.language === selected.language
            return (
              <tr
                key={r.language}
                onClick={() => onSelect(r)}
                className={`cursor-pointer border-b border-rule transition-colors duration-150 hover:bg-wash ${on ? 'bg-wash' : ''}`}
              >
                <th scope="row" className="py-2.5 pr-4 text-left font-normal">
                  <button type="button" onClick={(e) => (e.stopPropagation(), onSelect(r))} className={`rounded-sm text-left hover:underline ${on ? 'font-semibold' : ''}`}>
                    {r.language}
                  </button>
                  <span className="ml-2 text-[12px] text-ink-3 tabular-nums">{int(r.home_speakers)}</span>
                </th>
                {COLUMNS.map((c) => {
                  const n = cov[c.key] as number
                  return (
                    <td key={c.key} className="px-2 py-2.5 text-center" title={n ? `${int(n)} ${c.unit}` : 'None'}>
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${n ? 'bg-ink' : 'border border-ink-3'}`}
                        aria-label={n ? `${int(n)} ${c.unit}` : 'none'}
                        role="img"
                      />
                    </td>
                  )
                })}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
