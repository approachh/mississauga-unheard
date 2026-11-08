---
version: 1
slug: "src-app-tsx"
primary_target: "src/App.tsx"
related_targets: ["src/pages/Overview.tsx","src/pages/SpeechIntelligence.tsx"]
---

# VOXELO app shell (Overview, Speech Intelligence, Community, Voice)

Scope: whole frontend app. Mode: Operate (research dashboard used in a live demo and by the team).
Audience/job: judges and team read how well voice AI understands each language, inspect individual transcripts, and trust where every number came from.
Constraints: Recharts, Tailwind, JSON data layer unchanged; sample data always flagged; no fabricated findings; light theme chosen for projection in bright rooms.
Memorable moment: a real sentence, said vs heard, marked in red like a proofread galley, above a ranked table of error rates.

## Direction contract

THESIS: VOXELO reads like a statistical release, not a startup dashboard. Figures sit in ruled, right-aligned tables with provenance flags and footnotes; refuses the dark card grid with glowing accent and stat tiles.

OWN-WORLD: White ground, near-black ink, zinc greys for rules and secondary text. A black top bar is the shell. One colour, proof red, appears only where the AI misheard: diff marks and the error-rate ramp. Amber is reserved for the sample-data state. Hanken Grotesk with tabular figures, JetBrains Mono only for codes and IDs. Hairline rules, 6px radii, no shadows, no cards for single numbers.

STORY: The visitor sees the tagline next to a live said/heard specimen, then the key figures, then the ranked languages. They understand what was measured, which languages fare worst, and that the current figures are sample placeholders, then drill into Speech Intelligence to filter, sort and read transcripts.

FIRST VIEWPORT: Black top bar (wordmark left, four tabs, data status right). Below, a two-column band: left H1 "What you say. What AI hears." at ~56px with a two-sentence lede; right a said/heard specimen with red proof marks. Under it, a ruled figures strip of four numbers with flags, then the start of the ranked table.

FORM: candidate 3 of 7 (Statistics Canada table/data-quality-flag publication). seed:02ce3698eb7bc215. Signature move: every figure carries a superscript provenance flag (S = sample placeholder, C = computed in browser) resolved in a footnote block, and misheard words are marked as red proof corrections. Raises from declined challengers: colour only where it means something (warm consumer app); bar length always true to value, axes from zero (labanotation); selected row focused, others kept as context (transit map); prose held to a 65ch measure (lexicon); nothing labelled twice (catalog sleeve); ranked rows in fixed columns (split-flap).

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
