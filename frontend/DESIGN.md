---
name: VOXELO
description: What you say. What AI hears. A statistical release on how well voice AI understands the languages of Mississauga.
colors:
  paper: "#ffffff"
  wash: "#f6f6f7"
  ink: "#0b0b0c"
  ink-2: "#3f3f46"
  ink-3: "#6b6b74"
  rule: "#e6e6e9"
  rule-2: "#d4d4d8"
  proof: "#c8281c"
  proof-ink: "#a01f15"
  proof-soft: "#fdecea"
  proof-light: "#f2a59c"
  sample: "#8a4b06"
  sample-bg: "#fff8e6"
  sample-line: "#f5d58a"
typography:
  display:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "3.5rem"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.75rem"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.03em"
  figure:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  title:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.015em"
  lede:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.625
  body:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.55
    fontFeature: "tnum"
  table:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.43
    fontFeature: "tnum"
  label:
    fontFamily: "Hanken Grotesk, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  flag: "3px"
  inner: "4px"
  md: "6px"
  specimen: "8px"
  dot: "9999px"
spacing:
  page-x-mobile: "20px"
  page-x: "32px"
  container: "1200px"
  section-gap: "80px"
  section-head: "20px"
  row-y: "10px"
  measure: "65ch"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
    typography: "{typography.table}"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-quiet:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  button-quiet-hover:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink}"
  chip:
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "32px"
    typography: "{typography.label}"
  chip-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
  segmented:
    backgroundColor: "{colors.wash}"
    rounded: "{rounded.md}"
    padding: "3px"
  segmented-option-active:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.inner}"
    height: "32px"
  input-search:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
    padding: "0 36px"
    height: "40px"
  top-bar:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    height: "56px"
  flag-sample:
    backgroundColor: "{colors.sample-bg}"
    textColor: "{colors.sample}"
    rounded: "{rounded.flag}"
    height: "15px"
  flag-computed:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.flag}"
    height: "15px"
  sample-banner:
    backgroundColor: "{colors.sample-bg}"
    textColor: "{colors.sample}"
  notice:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
---

# Design System: VOXELO

## Overview

**Creative North Star: "The Statistical Release"**

VOXELO reads like a national statistics publication that happens to be interactive. Figures sit in ruled, right-aligned tables; every number carries a small boxed provenance flag resolved in a Notes block at the foot of the page; and the one place colour appears is where the machine got a word wrong, marked like a proofreader's correction on a galley. The page is white paper and near-black ink, held inside a black top bar.

Density is moderate and editorial: generous vertical air between sections (64 to 80px), tight rhythm inside them (10px table rows, hairline dividers). Structure comes from rules, not boxes. A section begins with a full-width ink rule above its heading; lists and tables are separated by pale hairlines. Single numbers are never put in cards. Motion is almost absent: one authored animation, the proof marks drawing in under the Overview specimen.

The system rejects the dark card grid with glowing accents and stat tiles, gradients, glows and decorative animation (PRODUCT.md brand commitment).

**Key Characteristics:**
- White ground, near-black ink, zinc greys for secondary text and rules.
- One meaningful colour, proof red, used only for misrecognition: diff marks, error-rate bars, the red bar in the logo.
- Amber reserved exclusively for the sample-data state.
- Ink-ruled sections, hairline-ruled rows, no container boxes for content.
- Superscript provenance flags (S, C) on every figure, resolved in Notes.
- Tabular figures everywhere; mono only for codes, IDs and file names.

## Colors

A monochrome publication palette with one semantic red and one quarantined amber.

### Primary
- **Proof Red** (`proof`): the error colour. Underlines substituted words in the Heard line, the missing-word caret, the strikethrough on words not heard, the WER bars in the ranked table and chart, and the last bar of the logo mark. It means "the AI misheard"; it is never decoration, emphasis, or a link colour.
- **Proof Ink** (`proof-ink`): text colour of marked words (substituted, deleted, inserted), so red text holds AA contrast on white.
- **Proof Light** (`proof-light`): the reference-side underline on the Said line, and the CER series in the chart (the secondary measure of the same error).
- **Proof Soft** (`proof-soft`): background tint for inserted words.

### Secondary
- **Sample Amber** (`sample`, `sample-bg`, `sample-line`): text, fill and border of the sample-data state only: the S flag, the sample banner under the top bar, and the status dot when data is sample.

### Neutral
- **Paper** (`paper`): page ground, text on the ink bar, active segmented option.
- **Wash** (`wash`): the quietest fill: selected/hovered table rows, empty bar tracks, segmented track, inline code, notices, skeletons.
- **Ink** (`ink`): body text, the top bar, section rules, table header rule, primary button, active chip, focus ring, selection.
- **Ink 2** (`ink-2`): ledes, secondary prose, numbers in supporting columns.
- **Ink 3** (`ink-3`): labels, captions, metadata, inactive controls, dimmed rows.
- **Rule** (`rule`): hairlines between rows and around the specimen's internal bands; chart gridlines.
- **Rule 2** (`rule-2`): control borders (chips, inputs, segmented, flags C), specimen frame, dashed empty-state border.

### Named Rules
**The Proof Red Rule.** Red appears only where the AI misheard. If removing the red would not lose information about an error, the red should not be there.

**The Quarantined Amber Rule.** Amber marks sample data and nothing else. Real data never touches amber; warnings and errors use neutral notices with an icon.

## Typography

**Display Font:** Hanken Grotesk (with ui-sans-serif, system-ui)
**Body Font:** Hanken Grotesk, weights 400 / 500 / 600 / 700
**Label/Mono Font:** JetBrains Mono (with ui-monospace), for language codes, clip IDs, file names and formulas only

**Character:** One sober grotesque does all the work, set with tabular numerals so columns align; the monospace is a functional marker that says "this is an identifier", never a style.

### Hierarchy
- **Display** (600, 2.6rem mobile / 3.5rem desktop, 1.02, -0.035em): the Overview H1 only; second line in Ink 3.
- **Headline** (600, 2.25rem / 2.75rem, 1.08, -0.03em): page titles on app pages.
- **Figure** (600, 28px, 1, -0.02em): key figures strip. Per-clip and aside figures step down to 17px semibold.
- **Title** (600, 1.25rem, -0.015em): section headings sitting on an ink rule; question titles at 19px.
- **Lede** (400, 17px, relaxed): the paragraph under a page title, held to 52 to 68ch.
- **Body** (400, 15px, 1.55): default text, tabular numerals on.
- **Table** (400, 14px): table cells, notices, secondary prose.
- **Label** (500, 13px): column heads, filter labels, legends, captions, Notes. Sentence case, no tracking.
- **Code** (JetBrains Mono 400, 11px for IDs beside names, 12 to 13px inside code chips).
- **Specimen text** (20 to 22px, 1.6): the said/heard specimen on Overview; 16px / 1.65 in transcript lists.

### Named Rules
**The Tabular Figures Rule.** `font-variant-numeric: tabular-nums` is set on body; numbers in tables are right-aligned. Never turn it off.

**The Measure Rule.** Prose is held to roughly 65ch (52ch for the hero lede, 70ch for notes).

**The Mono Means Identifier Rule.** Monospace is for codes, IDs, file names and formulas. It is never a headline, label, or decorative voice.

## Layout

Single centred column, max 1200px, side padding 20px (mobile) / 32px (sm and up). Main content starts 40px / 56px below the bar and ends 64px above the footer. Sections are stacked with 64px (mobile) / 80px (desktop) between them on Overview, 48 / 64px on app pages.

Overview opens with a two-column band at lg: claim and lede on the left, the said/heard specimen on the right (columns 1fr : 1.05fr, 56px gap), then a full-width figures strip ruled top and bottom in ink (2 columns on mobile, 4 at lg, cells divided by hairlines). Speech Intelligence uses a filter strip ruled above and below, then a chart + 300px aside grid at lg, then a full-width transcript list whose rows are a 180px meta column beside the proof lines.

Every section header sits on a full-width 1px ink rule with 16px above the title and 20px below the header block; an optional action link aligns to the right baseline. Tables run edge to edge with an ink rule under the head and Rule hairlines between rows (10px vertical cell padding). Mobile collapses grids to one column, hides inline bars in the ranked table, and moves nav tabs to a second scrollable row in the bar.

Breakpoints are Tailwind defaults: sm 640px, md 768px, lg 1024px.

## Elevation & Depth

Flat. Depth is expressed with rules and the Wash tint, not shadow. The page has no raised surfaces. Two small exceptions exist in the build and are the only sanctioned shadows: the active option of a segmented control lifts by a 1px hairline shadow so it reads as a selected key, and the chart tooltip, the one floating layer, carries a soft ambient shadow to separate it from the plot.

### Shadow Vocabulary
- **Segment lift** (`box-shadow: 0 1px 2px rgb(0 0 0 / 0.08), 0 0 0 1px var(--color-rule-2)`): active segmented option only.
- **Floating layer** (`box-shadow: 0 4px 16px rgb(0 0 0 / 0.08)`): chart tooltip only.

### Named Rules
**The Rules Not Boxes Rule.** Group content with a ruled edge, not a card. A box is reserved for the specimen frame, controls, notices and empty states.

## Shapes

Small, quiet radii. Controls, notices, empty states and inline code blocks use 6px. The Overview specimen frame uses 8px, the only larger radius. Flags and inline code chips use 3px; the inner segmented option uses 4px; status dots are circles. Bars in tables and charts are square-ended. Borders are 1px; the only dashed border is the empty state.

## Components

### Buttons
Plain, typographic, sparing: there is one filled button per view.
- **Shape:** gently rounded (6px), 40px tall.
- **Primary:** Ink fill, Paper text, 14px medium, 16px horizontal padding, optional trailing 16px arrow icon. Hover shifts to Ink 2.
- **Quiet:** no fill, Ink 2 text, 12px padding; hover gains a Wash fill and Ink text.
- **Text link action:** 14px medium Ink text with a small trailing arrow, underline on hover (section header actions).
- **Focus:** global 2px Ink outline, 2px offset, 4px radius.

### Chips (language filter)
- **Style:** 32px tall, 6px radius, 1px Rule 2 border, Ink 2 text at 13px medium, 12px padding.
- **State:** active is a solid Ink fill with Paper text and Ink border; hover darkens the border to Ink 3 and text to Ink. Single-select with an "All" chip first.

### Segmented control
- **Style:** Wash track, 1px Rule 2 border, 6px radius, 3px inset. Options 32px tall, 13px medium, Ink 3 text.
- **State:** active option is Paper with Ink text and the segment-lift shadow; hover raises text to Ink.

### Inputs / Fields
- **Style:** 40px search field, Paper fill, 1px Rule 2 border, 6px radius, 14px text, leading 16px search icon in Ink 3, optional clear button on the right.
- **Focus:** border turns Ink, no glow. Hover border is Ink 3.

### Navigation
- **Style:** sticky black bar, 56px tall. Wordmark left (four-bar waveform mark, last bar Proof Red; "VOXELO" 15px bold, 0.14em tracking). Tabs 14px medium, White at 60% inactive, Paper active with a 2px Paper underline on the bar's bottom edge. Data-status readout on the right: 13px, a coloured dot (Paper published, Sample Line for sample, outlined for incomplete).
- **Mobile:** tabs move to a second 44px row under a faint top border and scroll horizontally.
- **Sample banner:** when data is sample, an amber strip (Sample BG fill, Sample Line bottom border, 13px Sample text with a flask icon) sits inside the sticky header.

### Ranked table
The core figure display. Language name plus mono code in the row head, right-aligned numeric columns, sortable column heads (13px, active in Ink with a 12px arrow), S flags on measured columns. The ranked metric can show an inline bar: 8px tall Wash track up to 220px, Proof Red fill with length true to value from zero. Selected row gets Wash and semibold name; other rows dim to Ink 3 but stay readable.

### Error-rate chart
Horizontal grouped bars, ranked worst first, x-axis from zero with an Ink axis line and Rule gridlines. WER in Proof Red, CER in Proof Light, value labels at bar ends in 11px Ink 2. Language labels carry clip counts beneath in Ink 3. Unselected languages fade to 22% fill.

### Proof lines (said / heard)
The signature component. A two-row definition grid with "Said" / "Heard" labels (13px medium Ink 3) in a 56px column.
- Substituted word, heard side: Proof Ink text with a 2px Proof Red underline.
- Substituted word, said side: 2px Proof Light underline.
- Word not heard: Proof Ink strike-through (1.5px Proof Red) on the said side, a small Proof Red triangle caret in the heard line.
- Inserted word: Proof Soft tint, 3px radius, Proof Ink text.
- Lines are `dir="auto"` so RTL scripts align correctly.
- **Motion:** on the Overview specimen only, underlines draw in left to right and inserted tints fade in, 700ms `cubic-bezier(0.16, 1, 0.3, 1)`, staggered 90ms per mark after 250ms. Disabled under reduced motion.

### Provenance flag
A 15px boxed capital letter set superscript after a figure: S on Sample amber, C (computed in browser) on Wash with Rule 2 border and Ink 2 text. 10px semibold, 3px radius. Every flag kind used on a page is resolved in that page's Notes.

### Notes
Page footer block on an ink rule: 13px Ink 2, "Notes" heading in semibold Ink, a flag legend and a sources list (label column 96px in Ink 3, file names in code chips) side by side at md, then method notes held to 70ch.

### Notices and empty states
- **Notice:** Wash fill, 1px Rule 2 border, 6px radius, 14px Ink 2 text with a 16px Ink 3 icon. Used for missing or unreadable data, never coloured.
- **Empty state:** dashed Rule 2 border, Wash fill, 6px radius, 18px Ink 3 icon above a medium title and Ink 3 explanation naming the file that is awaited.

## Do's and Don'ts

### Do:
- **Do** start every section with a full-width 1px Ink rule above a 1.25rem semibold heading.
- **Do** put a provenance flag on every figure drawn from sample or browser-computed data, and resolve it in Notes.
- **Do** right-align numbers with tabular figures, and draw bars from zero with lengths true to value.
- **Do** keep Proof Red for misrecognition and Sample Amber for sample data, nothing else.
- **Do** show a selected item by focusing it (Wash, semibold) and dimming the rest to Ink 3, not by hiding the rest.
- **Do** name the awaited file in an empty state (in a mono code chip).

### Don't:
- **Don't** put single numbers in cards or stat tiles; use the ruled figures strip or a ruled definition list.
- **Don't** use gradients, glows, dark card grids or decorative animation.
- **Don't** add shadows beyond the segment lift and the floating tooltip.
- **Don't** use monospace for anything other than codes, IDs, file names and formulas.
- **Don't** colour warnings or errors red or amber; red means misheard, amber means sample.
- **Don't** let sample figures appear without the S flag and the sample banner.
