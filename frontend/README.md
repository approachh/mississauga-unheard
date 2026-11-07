# VOXELO — frontend

*What you say. What AI hears.* React + TypeScript + Vite + Tailwind v4 + Recharts + Lucide.

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
npm run lint
```

## Data

The app reads JSON from `public/data/`. Drop `language_results.json` /
`transcription_results.json` there and they replace the `*.sample.json`
placeholders automatically. Every figure from a sample file carries an
**S** flag and the shell shows a sample-data banner; **C** marks values
computed in the browser. Both are explained in each page's Notes. See [public/data/README.md](public/data/README.md).

## Structure

```
src/
  components/   shell, Section/PageTitle, RankedTable, ErrorRateChart, ProofLines (said/heard),
                Flag + Notes (provenance flags and footnotes), DataIssues, Segmented, EmptyState
  pages/        Overview, SpeechIntelligence, ComingSoon (Community, Voice placeholders)
  services/     dataService.ts — loading, sample fallback, validation
  hooks/        useDataset
  lib/          word-level diff, formatting
  types/        data interfaces
  styles/       Tailwind theme tokens
```

No API keys belong in this folder. ElevenLabs calls will go through a server-side proxy (Phase 2+).
