import type { ReactNode } from 'react'

/**
 * Provenance and licence attribution for the census and speech-dataset figures.
 * Census: City of Mississauga "2021 Census Data - By Wards - Table" (ArcGIS item
 * 1db3b606ed2f466584409b8bbf8ebe9d), Statistics Canada Open Licence. Values were verified
 * against the published table; Ward 10 home-language figures were adjusted by the VOXELO
 * census team, so the attribution uses the licence's "Adapted from" form.
 */
export const CENSUS_DATASET_URL = 'https://www.arcgis.com/home/item.html?id=1db3b606ed2f466584409b8bbf8ebe9d'
export const STATCAN_LICENCE_URL = 'https://www.statcan.gc.ca/en/terms-conditions/open-licence'
const WARDS_DATASET_URL = 'https://www.arcgis.com/home/item.html?id=f1cad02b3a40422dac2ea99b59cc36a5'
const WARDS_TERMS_URL = 'https://smartcity.mississauga.ca/wp-content/uploads/2021/04/CityofMississauga_TermsofUse.pdf'

const SPEECH_DATASETS = [
  { name: 'FLEURS', by: 'Google', licence: 'CC BY 4.0', url: 'https://huggingface.co/datasets/google/fleurs' },
  { name: 'MINDS-14', by: 'PolyAI', licence: 'CC BY 4.0', url: 'https://huggingface.co/datasets/PolyAI/minds14' },
  { name: 'Speech-MASSIVE', by: 'FBK', licence: 'CC BY-NC-SA 4.0', url: 'https://huggingface.co/datasets/FBK-MT/Speech-MASSIVE' },
  { name: 'Speech Accent Archive', by: 'George Mason University', licence: 'CC BY-NC-SA 4.0', url: 'https://accent.gmu.edu/' },
]

const Ext = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className="underline decoration-rule-2 underline-offset-[3px] hover:decoration-ink">
    {children}
  </a>
)

export function SourceAttribution() {
  return (
    <section aria-labelledby="sources-h" className="grid gap-x-16 gap-y-6 border-t border-ink pt-5 text-[13px] leading-relaxed text-ink-2 md:grid-cols-2">
      <div>
        <h2 id="sources-h" className="mb-2 text-[13px] font-semibold text-ink">
          Census source
        </h2>
        <p>
          Adapted from Statistics Canada, 2021 Census of Population, custom tabulation by ward for the City of
          Mississauga: <Ext href={CENSUS_DATASET_URL}>“2021 Census Data - By Wards - Table”</Ext>, City of Mississauga
          Open Data, used under the <Ext href={STATCAN_LICENCE_URL}>Statistics Canada Open Licence</Ext>. This does not
          constitute an endorsement by Statistics Canada of this product.
        </p>
        <p className="mt-2">
          Modified: Ward 10 home-language counts for 14 languages were corrected by the VOXELO census team and differ
          from the published table. All other ward figures match it.
        </p>
        <h2 className="mt-5 mb-2 text-[13px] font-semibold text-ink">Ward boundaries</h2>
        <p>
          <Ext href={WARDS_DATASET_URL}>“Ward Boundaries”</Ext>, City of Mississauga Open Data, used under the City’s{' '}
          <Ext href={WARDS_TERMS_URL}>Terms of Use</Ext>. Outlines simplified to within 4 metres for display.
        </p>
      </div>
      <div>
        <h2 className="mb-2 text-[13px] font-semibold text-ink">Speech dataset coverage</h2>
        <p>
          Coverage shows how many recordings these public datasets hold per language. VOXELO publishes the counts only,
          not the recordings.
        </p>
        <ul className="mt-2 space-y-0.5">
          {SPEECH_DATASETS.map((d) => (
            <li key={d.name}>
              <Ext href={d.url}>{d.name}</Ext>, {d.by}, {d.licence}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
