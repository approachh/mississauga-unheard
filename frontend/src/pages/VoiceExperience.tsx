import { AlertTriangle, ChevronDown, RotateCcw, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Disclosure } from '../components/Disclosure'
import { LanguagePicker } from '../components/voice/OptionPicker'
import { ClipCard, MeterBand, Orb, type Clip } from '../components/voice/Recorder'
import { Code } from '../components/EmptyState'
import { Flag } from '../components/Flag'
import { Notes } from '../components/Notes'
import { Words } from '../components/story/Story'
import { DiffLegend, ProofLines } from '../components/TranscriptDiff'
import { useRecorder } from '../hooks/useRecorder'
import { charErrorRate, diffWords, summarise } from '../lib/diff'
import { fmtTime, pct } from '../lib/format'
import {
  MAX_RECORDING_SECONDS,
  TranscriptionError,
  checkAudio,
  getServiceStatus,
  languageName,
  transcribe,
  type ServiceStatus,
  type TranscriptionResponse,
} from '../lib/voice'

type Phase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; result: TranscriptionResponse; language: string }
  | { kind: 'error'; error: TranscriptionError }

/** Narrow column for the reading sections below the stage. */
const COLUMN = 'mx-auto w-full max-w-[600px] px-5'
/** The dark stage is wider: the waveform and the language chips use the room. */
const STAGE = 'mx-auto w-full max-w-[1000px] px-5 sm:px-8'

export function VoiceExperience() {
  const [language, setLanguage] = useState('auto')
  const [clip, setClip] = useState<Clip | null>(null)
  const [clipError, setClipError] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [showReference, setShowReference] = useState(false)
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [service, setService] = useState<ServiceStatus | null | 'checking'>('checking')
  const [dragging, setDragging] = useState(false)

  const meterRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ac = new AbortController()
    getServiceStatus(ac.signal).then((s) => !ac.signal.aborted && setService(s))
    return () => ac.abort()
  }, [])

  const replaceClip = useCallback((next: Clip | null) => {
    setClip((prev) => {
      if (prev) URL.revokeObjectURL(prev.url)
      return next
    })
    abortRef.current?.abort()
    setPhase({ kind: 'idle' })
  }, [])

  // Release the object URL when leaving the page; nothing is kept after that.
  const clipRef = useRef(clip)
  useEffect(() => {
    clipRef.current = clip
  }, [clip])
  useEffect(
    () => () => {
      if (clipRef.current) URL.revokeObjectURL(clipRef.current.url)
      abortRef.current?.abort()
    },
    [],
  )

  const onRecorded = useCallback(
    (blob: Blob) => {
      const err = checkAudio(blob, 'recording.webm')
      setClipError(err)
      replaceClip(err ? null : { blob, url: URL.createObjectURL(blob), name: 'Your recording', source: 'recording' })
    },
    [replaceClip],
  )
  const recorder = useRecorder(onRecorded, meterRef)

  const acceptFile = (file: File | undefined) => {
    if (!file) return
    const err = checkAudio(file, file.name)
    setClipError(err)
    if (!err) replaceClip({ blob: file, url: URL.createObjectURL(file), name: file.name, source: 'upload' })
  }

  const run = async () => {
    if (!clip) return
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    setPhase({ kind: 'sending' })
    requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    try {
      const result = await transcribe(clip.blob, language, ac.signal, clip.source === 'upload' ? clip.name : 'recording.webm')
      if (!ac.signal.aborted) setPhase({ kind: 'done', result, language })
    } catch (e) {
      if (ac.signal.aborted || (e instanceof DOMException && e.name === 'AbortError')) return
      setPhase({ kind: 'error', error: e instanceof TranscriptionError ? e : new TranscriptionError('unknown', 'Something went wrong.') })
    }
  }

  const cancel = () => {
    abortRef.current?.abort()
    setPhase({ kind: 'idle' })
  }

  const configured = service !== 'checking' && service?.configured === true
  const isRecording = recorder.state === 'recording'
  const recording = isRecording || recorder.state === 'requesting'
  const canSubmit = !!clip && configured && phase.kind !== 'sending' && !recording

  const progress = Math.min(1, recorder.elapsed / MAX_RECORDING_SECONDS)
  const busy = phase.kind === 'sending'

  return (
    <>
      <section
        aria-label="Voice demo"
        className="voice-atmosphere relative overflow-hidden bg-ink pt-14 pb-16 text-paper sm:pt-20 sm:pb-24"
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          if (!recording) setDragging(true)
        }}
        onDragLeave={(e: DragEvent) => {
          if (e.currentTarget === e.target) setDragging(false)
        }}
        onDrop={(e: DragEvent) => {
          e.preventDefault()
          setDragging(false)
          if (!recording) acceptFile(e.dataTransfer.files[0])
        }}
      >
        <div className={STAGE}>
          <header className="text-center">
            <p className="text-[12px] font-medium tracking-[0.14em] text-[rgb(176_228_255/0.8)] uppercase">Voice demo</p>
            <h1 className="mt-4 text-[clamp(2.25rem,5.5vw,4rem)] leading-[1] font-semibold tracking-[-0.04em]">
              <Words text="Hear yourself through AI." />
            </h1>
            <p className="mx-auto mt-4 max-w-[34ch] text-[17px] text-white/60">Say a sentence in your language. See what AI hears.</p>
          </header>

          <div className="mt-8 empty:mt-0">
            <ServiceNotice service={service} />
          </div>

          <form
            className="mt-6"
            onSubmit={(e) => {
              e.preventDefault()
              if (canSubmit) void run()
            }}
          >
            <LanguagePicker value={language} onChange={setLanguage} disabled={busy} />

            {/* Stage: a live waveform runs behind the recorder */}
            <div className="relative mx-auto mt-6 grid min-h-44 place-items-center sm:mt-10 sm:min-h-56">
              <MeterBand meterRef={meterRef} isRecording={isRecording} dimmed={!!clip && !recording} />

              <div className="relative flex w-full justify-center py-2">
                {clip && !recording ? (
                  <ClipCard clip={clip} busy={busy} canSubmit={canSubmit} actionLabel="Show me what AI heard" busyLabel="Listening…" onClear={() => replaceClip(null)} onCancel={cancel} />
                ) : (
                  <Orb
                    state={recorder.state}
                    isRecording={isRecording}
                    progress={progress}
                    disabled={recorder.state === 'unsupported' || recorder.state === 'requesting' || busy}
                    onClick={() => {
                      if (isRecording) return recorder.stop()
                      setClipError(null)
                      void recorder.start()
                    }}
                  />
                )}
              </div>

              {dragging && (
                <div className="absolute inset-x-0 inset-y-4 grid place-items-center rounded-[32px] bg-ink/70 text-[15px] font-medium ring-1 ring-[rgb(176_228_255/0.6)] backdrop-blur-sm">
                  Drop an audio file
                </div>
              )}
            </div>

            {/* Status under the stage */}
            <div className="mt-2 flex flex-col items-center text-center" aria-live="polite">
              {!clip || recording ? (
                <>
                  <p className="text-[17px] text-white/70">
                    {isRecording ? (
                      <>
                        <span className="font-semibold text-paper tabular-nums">{fmtTime(recorder.elapsed)}</span>
                        <span className="text-white/45"> / {fmtTime(MAX_RECORDING_SECONDS)}</span> · tap to stop
                      </>
                    ) : recorder.state === 'requesting' ? (
                      'Allow microphone access'
                    ) : (
                      'Tap to record'
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={recording || busy}
                    className="mt-4 inline-flex items-center gap-2 text-[14px] font-medium text-white/55 underline decoration-white/20 underline-offset-4 transition-colors hover:text-paper hover:decoration-white/60 disabled:opacity-40"
                  >
                    <Upload className="h-4 w-4" aria-hidden /> or upload an audio file
                  </button>
                </>
              ) : (
                <p className="text-[14px] text-white/45">
                  {!configured && service !== 'checking' ? 'Transcription is not available on this server yet.' : 'Sent to ElevenLabs for transcription. VOXELO keeps nothing.'}
                </p>
              )}
              <RecorderMessage state={recorder.state} />
              {clipError && (
                <p role="alert" className="mt-4 flex max-w-[48ch] items-start justify-center gap-2 text-[14px] text-paper">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {clipError}
                </p>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="audio/*,.webm,.ogg,.mp3,.m4a,.wav,.flac"
                className="sr-only"
                tabIndex={-1}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  acceptFile(e.target.files?.[0])
                  e.target.value = ''
                }}
              />
            </div>

            {/* Optional reference text */}
            <div className="mx-auto mt-10 max-w-[520px]">
              <button
                type="button"
                aria-expanded={showReference}
                aria-controls="voice-reference-panel"
                onClick={() => setShowReference((v) => !v)}
                className="mx-auto flex items-center gap-2 text-[14px] font-medium text-white/60 transition-colors hover:text-paper"
              >
                <span>
                  What did you say? <span className="font-normal text-white/40">Optional, to measure errors</span>
                </span>
                <ChevronDown className={`h-4 w-4 transition-transform duration-300 ${showReference ? 'rotate-180' : ''}`} aria-hidden />
              </button>
              <div id="voice-reference-panel" className="disclosure-body" data-open={showReference} inert={!showReference}>
                <div>
                  <label htmlFor="voice-reference" className="sr-only">
                    What you said
                  </label>
                  <textarea
                    id="voice-reference"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    rows={3}
                    dir="auto"
                    placeholder="Type the exact words you said"
                    className="mt-4 block w-full resize-y rounded-2xl bg-white/[0.05] px-4 py-3 text-[16px] leading-relaxed text-paper ring-1 ring-white/12 transition-[box-shadow] placeholder:text-white/35 hover:ring-white/25 focus:ring-[rgb(176_228_255/0.7)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </form>

          {/* Results */}
          <div ref={resultRef} className="mx-auto mt-12 max-w-[760px] scroll-mt-20 empty:mt-0" aria-live="polite">
            {phase.kind !== 'idle' && (
              <section aria-label="Result" className="swap-in rounded-[28px] bg-white/[0.04] p-7 ring-1 ring-white/10 backdrop-blur-xl sm:p-10">
                <Results phase={phase} reference={reference} onRetry={() => void run()} canRetry={canSubmit} onAddReference={() => setShowReference(true)} />
              </section>
            )}
          </div>
        </div>
      </section>

      <div className={`${COLUMN} pt-4 pb-20`}>
        <div className="border-t border-ink">
          <Disclosure title="About this demo" summary="Privacy, limits and what one recording can tell you.">
            <Notes
              flags={phase.kind === 'done' && reference.trim() ? ['C'] : []}
              sources={[
                { label: 'Transcription', value: <>ElevenLabs Scribe, through the server endpoint <Code>/api/transcribe</Code></> },
                { label: 'Privacy', value: 'Audio is processed in memory and discarded. Nothing is stored or logged by VOXELO.' },
                { label: 'Limits', value: 'Up to 4 MB or one minute. WebM, OGG, MP3, M4A, WAV or FLAC.' },
              ]}
            >
              One recording is a demonstration, not a measurement. Results vary with microphone, background noise,
              speaking style and the words chosen.
            </Notes>
          </Disclosure>
        </div>
      </div>
    </>
  )
}

function RecorderMessage({ state }: { state: string }) {
  const msg =
    state === 'denied'
      ? 'Microphone access was blocked. Allow it in your browser settings, or upload a file.'
      : state === 'unsupported'
        ? 'Recording isn’t available in this browser. Upload a file instead.'
        : state === 'error'
          ? 'No microphone found. Connect one, or upload a file.'
          : null
  return msg ? <p className="mt-4 max-w-[44ch] text-[14px] text-white/60">{msg}</p> : null
}

function ServiceNotice({ service }: { service: ServiceStatus | null | 'checking' }) {
  if (service === 'checking' || service?.configured) return null
  return (
    <div role="status" className="mx-auto flex max-w-[640px] items-start gap-2.5 rounded-2xl px-5 py-4 text-[14px] text-white/65 ring-1 ring-white/15">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-hidden />
      <p>
        {service === null ? (
          <>
            <strong className="font-semibold text-paper">Transcription isn’t available on this deployment.</strong> You can
            still record and play back.
          </>
        ) : (
          <>
            <strong className="font-semibold text-paper">Live transcription is not set up yet.</strong> The server needs an
            ElevenLabs API key (<Code>ELEVENLABS_API_KEY</Code>).
          </>
        )}
      </p>
    </div>
  )
}

function Results({
  phase,
  reference,
  onRetry,
  canRetry,
  onAddReference,
}: {
  phase: Phase
  reference: string
  onRetry: () => void
  canRetry: boolean
  onAddReference: () => void
}) {
  const hyp = phase.kind === 'done' ? phase.result.text : ''
  const ref = reference.trim()
  const comparison = useMemo(() => {
    if (phase.kind !== 'done' || !ref) return null
    const tokens = diffWords(ref, hyp)
    return { tokens, s: summarise(tokens), cer: charErrorRate(ref, hyp) }
  }, [phase.kind, ref, hyp])

  if (phase.kind === 'idle') return null

  if (phase.kind === 'sending')
    return (
      <div aria-busy="true">
        <p className="text-[15px] text-white/60">Listening to your recording…</p>
        <div className="mt-8 space-y-4">
          <div className="h-10 w-11/12 animate-pulse rounded-lg bg-white/10" />
          <div className="h-10 w-2/3 animate-pulse rounded-lg bg-white/10" />
        </div>
      </div>
    )

  if (phase.kind === 'error')
    return (
      <div role="alert" className="max-w-[60ch]">
        <p className="text-[1.75rem] font-semibold tracking-[-0.02em]">That didn’t work.</p>
        <p className="mt-4 text-[17px] text-white/70">{phase.error.message}</p>
        <p className="mt-2 text-[13px] text-white/45">
          Code <span className="font-mono">{phase.error.code}</span>
          {phase.error.retryAfter ? ` · try again in ${phase.error.retryAfter}s` : ''}
        </p>
        {canRetry && !['not_configured', 'no_endpoint', 'upstream_auth'].includes(phase.error.code) && (
          <button type="button" onClick={onRetry} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] font-medium ring-1 ring-white/25 transition-colors hover:ring-white">
            <RotateCcw className="h-4 w-4" aria-hidden /> Try again
          </button>
        )}
      </div>
    )

  const { result, language } = phase
  const detected = result.language_code
  const mismatch = language !== 'auto' && detected && !detected.startsWith(language) && !language.startsWith(detected)

  return (
    <article className="swap-in">
      <p className="text-[15px] text-white/60">AI heard</p>
      {result.text.trim() ? (
        <p dir="auto" className="mt-4 text-[clamp(1.5rem,3vw,2.125rem)] leading-[1.25] font-medium tracking-[-0.02em]">
          “{result.text.trim()}”
        </p>
      ) : (
        <p className="mt-4 text-[1.5rem] font-medium text-white/70">No speech recognised.</p>
      )}
      <p className="mt-8 text-[14px] text-white/50">
        {language === 'auto' ? 'Language detected' : `You chose ${languageName(language)}`}
        {detected && ` · heard as ${languageName(detected)}`}
        {result.language_probability !== null && ` (${pct(result.language_probability, 0)} sure)`}
      </p>
      {mismatch && <p className="mt-2 text-[14px] text-white/70">That’s a different language from the one you chose.</p>}

      {comparison ? (
        <div className="mt-10 border-t border-white/15 pt-8">
          <div className="rounded-2xl bg-paper p-5 text-ink sm:p-7">
            <ProofLines tokens={comparison.tokens} size="lg" />
            <div className="mt-6 border-t border-rule pt-4">
              <DiffLegend />
            </div>
          </div>
          <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 sm:grid-cols-3">
            <Metric label="of words wrong" value={comparison.s.wer === null ? 'n/a' : pct(comparison.s.wer, 0)} flag />
            <Metric label="of characters wrong" value={comparison.cer === null ? 'n/a' : pct(comparison.cer, 0)} flag />
            <Metric label="words differ" value={String(comparison.s.errors)} />
          </dl>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            onAddReference()
            document.getElementById('voice-reference')?.focus()
          }}
          className="mt-12 inline-flex h-12 items-center rounded-full border border-white/25 px-6 text-[15px] font-medium transition-colors hover:border-white"
        >
          Add what you said to compare
        </button>
      )}

      <p className="mt-14 max-w-[52ch] text-[14px] leading-relaxed text-white/50">
        One recording is a demo, not a measure of accuracy. Real results need many speakers.
      </p>
    </article>
  )
}

function Metric({ label, value, flag }: { label: string; value: string; flag?: boolean }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="mt-2 text-[15px] text-white/60">{label}</dt>
      <dd className="text-[clamp(2rem,4vw,2.75rem)] leading-none font-semibold tracking-[-0.04em] tabular-nums">
        {value}
        {flag && value !== 'n/a' && <Flag kind="C" />}
      </dd>
    </div>
  )
}
