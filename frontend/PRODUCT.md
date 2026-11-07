# Product

<!-- impeccable:product-schema 1 -->

> Inferred from the team's written briefs (Phase 1 brief and redesign brief, Nov 2026). No interview was held; the user asked for design decisions to be made without consultation. Items marked *(inferred)* are assumptions.

## Platform

web

## Users

- **Hackathon judges** (Sheridan Datathon 2026, ElevenLabs Track "Mississauga, Unheard") viewing a live demo, usually projected or on a laptop, for a few minutes. *(inferred: primary near-term audience)*
- **The research team** (four developers) checking results as Python analysis and census work land.
- **Community stakeholders and residents** who want to know whether voice AI understands their language. *(inferred: secondary)*

## Product Purpose

VOXELO investigates language accessibility gaps in voice AI. It transcribes speech in many languages and English accents with ElevenLabs Scribe, measures error against reference transcriptions (WER, CER), and connects those results with Mississauga census language data to show which communities may be underserved and where they live. Success: a viewer understands within seconds what was measured, how well each language is understood, and who is at risk of being unheard.

## Positioning

Pairs measured speech-recognition error per language with the local geography of the people who speak those languages, specific to Mississauga.

## Operating Context

- Results arrive as JSON from teammates: `language_results.json`, `transcription_results.json`, later census/ward data. Files live in `frontend/public/data/`.
- Until real files exist the UI shows placeholder sample data, always labelled as such.
- Live demonstration to judges; must work on desktop and mobile.

## Capabilities and Constraints

- Pages: Overview, Speech Intelligence (Q1 "Understood?"), Community Intelligence (Q2 "Who's Unheard, and Where?"), Voice Experience (record/upload, compare transcript).
- React + TypeScript + Vite + Tailwind + Recharts + Lucide.
- No backend yet; ElevenLabs API keys must never reach the browser. Voice features show as unavailable until a secure proxy exists.
- No authentication. Frontend code only inside `frontend/`.

## Brand Commitments

- Name: **VOXELO**. Tagline: **"What you say. What AI hears."**
- User preference (not strict): black/white foundation, neutral greys, at most one restrained accent. Avoid generic AI-startup aesthetics, gradients, glows, repetitive cards, decorative animation.

## Evidence on Hand

- No verified findings yet. All numbers currently shown come from `*.sample.json` placeholders.
- Must never fabricate statistics, population figures, or an "Unheard Index".

## Product Principles

1. Truth over polish: every number shows where it came from; sample data can never pass as a finding.
2. Say what was said, show what was heard: the comparison between the two is the core artifact.
3. Findings first: results lead, method supports.
4. Legible to non-experts in seconds, defensible to experts on inspection.

## Accessibility & Inclusion

The product is about being understood, so it must be readable: strong contrast, keyboard navigable, RTL and non-Latin scripts rendered correctly. *(inferred standard: WCAG 2.2 AA)*
