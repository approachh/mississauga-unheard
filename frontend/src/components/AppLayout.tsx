import { FlaskConical } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useDataset } from '../hooks/useDataset'
import {
  loadCitywideLanguages,
  loadLanguageResults,
  loadSpeechCoverage,
  loadTranscriptions,
  loadWardProfiles,
} from '../services/dataService'
import type { Dataset } from '../types/data'
import { Logo } from './Logo'

const NAV = [
  { to: '/', label: 'Overview', end: true },
  { to: '/speech', label: 'Speech' },
  { to: '/community', label: 'Community' },
  { to: '/voice', label: 'Voice' },
]

const DATA_ROUTES = ['/', '/speech']

export function AppLayout() {
  const { pathname } = useLocation()
  const langs = useDataset(loadLanguageResults)
  const trans = useDataset(loadTranscriptions)
  const city = useDataset(loadCitywideLanguages)
  const wards = useDataset(loadWardProfiles)
  const cov = useDataset(loadSpeechCoverage)
  // The bar reports on the data the current page actually shows.
  const statusFiles =
    pathname === '/community'
      ? [
          { name: 'Citywide ranking', ds: city },
          { name: 'Ward profile', ds: wards },
          { name: 'Dataset coverage', ds: cov },
        ]
      : [
          { name: 'Speech results', ds: langs },
          { name: 'Transcripts', ds: trans },
        ]
  const showSample = DATA_ROUTES.includes(pathname) && (langs.isSample || trans.isSample)

  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded focus:bg-paper focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 bg-ink text-paper">
        <div className="mx-auto flex h-14 max-w-[1200px] items-center gap-8 px-5 sm:px-8">
          <Link to="/" aria-label="VOXELO overview" className="rounded-sm">
            <Logo />
          </Link>
          <nav aria-label="Primary" className="hidden h-full items-stretch gap-1 sm:flex">
            {NAV.map((n) => (
              <Tab key={n.to} {...n} />
            ))}
          </nav>
          {pathname !== '/voice' && <DataStatus files={statusFiles} />}
        </div>
        {/* Mobile tabs */}
        <nav aria-label="Primary" className="flex h-11 items-stretch overflow-x-auto border-t border-white/10 px-2 sm:hidden">
          {NAV.map((n) => (
            <Tab key={n.to} {...n} />
          ))}
        </nav>
        {showSample && (
          <div className="border-b border-sample-line bg-sample-bg text-sample">
            <div className="mx-auto flex max-w-[1200px] items-start gap-2.5 px-5 py-2 text-[13px] leading-snug sm:items-center sm:px-8">
              <FlaskConical className="mt-px h-3.5 w-3.5 shrink-0 sm:mt-0" aria-hidden />
              <p>
                <strong className="font-semibold">Sample data.</strong> Figures marked{' '}
                <span className="flag flag-s ml-0 align-baseline">S</span> are placeholders for layout, not research
                findings.{' '}
                <a href="#notes" className="font-medium underline">
                  About the data
                </a>
              </p>
            </div>
          </div>
        )}
      </header>

      <main id="main" className="mx-auto w-full max-w-[1200px] flex-1 px-5 pt-10 pb-16 sm:px-8 sm:pt-14">
        <Outlet />
      </main>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-2 px-5 py-5 text-[13px] text-ink-3 sm:px-8">
          <span>VOXELO · What you say. What AI hears.</span>
          <span>Sheridan Datathon 2026 · ElevenLabs Track: Mississauga, Unheard</span>
        </div>
      </footer>
    </div>
  )
}

/** Right slot of the bar: where the figures on screen come from, per file. */
function DataStatus({ files: input }: { files: { name: string; ds: Dataset<unknown> }[] }) {
  if (input.some((f) => f.ds.status === 'loading')) return null
  const state = (d: Dataset<unknown>) =>
    d.status === 'ready' ? (d.isSample ? 'sample' : 'published') : d.status === 'error' ? 'unreadable' : 'missing'
  const files = input.map((f) => ({ name: f.name, s: state(f.ds) }))
  const allPublished = files.every((f) => f.s === 'published')
  const anySample = files.some((f) => f.s === 'sample')
  return (
    <p
      className="ml-auto flex items-center gap-2 text-[13px] text-white/70"
      title={files.map((f) => `${f.name}: ${f.s}`).join('\n')}
    >
      <span
        className={`h-2 w-2 rounded-full ${allPublished ? 'bg-paper' : anySample ? 'bg-sample-line' : 'border border-white/60'}`}
        aria-hidden
      />
      <span className="hidden sm:inline">Data:</span>
      {allPublished ? 'Published' : anySample ? 'Sample' : 'Incomplete'}
    </p>
  )
}

function Tab({ to, label, end }: { to: string; label: string; end?: boolean }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `relative flex shrink-0 items-center px-3 text-[14px] font-medium transition-colors duration-150 after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:transition-colors ${
          isActive ? 'text-paper after:bg-paper' : 'text-white/60 after:bg-transparent hover:text-paper'
        }`
      }
    >
      {label}
    </NavLink>
  )
}
