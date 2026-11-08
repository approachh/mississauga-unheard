import { AlertTriangle, ChevronDown, FileAudio, Loader2, Mic, RotateCcw, Square, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import { Disclosure } from '../components/Disclosure'
import { Code } from '../components/EmptyState'
import { Flag } from '../components/Flag'
import { Notes } from '../components/Notes'
import { Waveform, Words } from '../components/story/Story'
import { DiffLegend, ProofLines } from '../components/TranscriptDiff'
import { useRecorder } from '../hooks/useRecorder'
import { charErrorRate, diffWords, summarise } from '../lib/diff'
import { pct } from '../lib/format'
import {
  MAX_RECORDING_SECONDS,
  TranscriptionError,
  VOICE_LANGUAGES,
  checkAudio,
  getServiceStatus,
  languageName,
  transcribe,
  type ServiceStatus,
  type TranscriptionResponse,
} from '../lib/voice'

interface Clip {
  blob: Blob
  url: string
  name: string
  source: 'recording' | 'upload'
}

type Phase =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'done'; result: TranscriptionResponse; language: string }
  | { kind: 'error'; error: TranscriptionError }

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
const METER_BARS = 36
/** The whole page lives in one narrow, centred column. */
const COLUMN = 'mx-auto w-full max-w-[600px] px-5'

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

  return (
    <>
      <div className={`${COLUMN} pt-16 pb-10 text-center sm:pt-24`}>
        <Waveform bars={24} misheard={[8, 15]} className="mx-auto !h-10 max-w-[180px]" />
        <h1 className="mt-8 text-[clamp(2.25rem,5vw,3.25rem)] leading-[1.02] font-semibold tracking-[-0.04em]">
          <Words text="Hear yourself through AI." />
        </h1>
        <p className="mt-4 text-[17px] text-ink-2">Say a sentence in your language. See what AI hears.</p>
      </div>

      <div className={`${COLUMN} pb-12`}>
        <ServiceNotice service={service} />

        <form
          className={`relative mt-4 rounded-[32px] px-6 py-10 text-center transition-colors duration-200 sm:px-10 sm:py-12 ${dragging ? 'bg-rule' : 'bg-wash'}`}
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) void run()
          }}
          onDragOver={(e: DragEvent) => {
            e.preventDefault()
            if (!recording) setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e: DragEvent) => {
            e.preventDefault()
            setDragging(false)
            if (!recording) acceptFile(e.dataTransfer.files[0])
          }}
        >
          {/* Language */}
          <label htmlFor="voice-language" className="sr-only">
            Language
          </label>
          <div className="relative mx-auto inline-flex">
            <select
              id="voice-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={phase.kind === 'sending'}
              className="h-11 appearance-none rounded-full border border-rule-2 bg-paper pr-10 pl-5 text-[15px] font-medium transition-colors hover:border-ink-3 focus:border-ink focus:outline-none"
            >
              {VOICE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-4 h-4 w-4 -translate-y-1/2 text-ink-3" aria-hidden />
          </div>

          {clip && !recording ? (
            /* Recorded / uploaded clip */
            <div className="mx-auto mt-12 max-w-[520px] rounded-2xl bg-paper p-5 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)]">
              <div className="flex items-center justify-between gap-3">
                <span className="flex min-w-0 items-center gap-2.5 text-[15px] font-medium">
                  {clip.source === 'recording' ? <Mic className="h-4 w-4 shrink-0" aria-hidden /> : <FileAudio className="h-4 w-4 shrink-0" aria-hidden />}
                  <span className="truncate">{clip.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => replaceClip(null)}
                  disabled={phase.kind === 'sending'}
                  className="inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-2 hover:bg-wash hover:text-ink disabled:opacity-40"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden /> Start over
                </button>
              </div>
              <audio controls src={clip.url} className="mt-4 block h-10 w-full" aria-label="Play back your audio" />
            </div>
          ) : (
            /* Recorder */
            <div className="mt-12 flex flex-col items-center">
              <button
                type="button"
                onClick={() => {
                  if (isRecording) return recorder.stop()
                  setClipError(null)
                  void recorder.start()
                }}
                disabled={recorder.state === 'unsupported' || recorder.state === 'requesting' || phase.kind === 'sending'}
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
                className="group relative grid h-28 w-28 place-items-center rounded-full bg-ink text-paper transition-transform duration-200 ease-out hover:scale-105 active:scale-95 disabled:cursor-not-allowed disabled:bg-rule-2 disabled:text-ink-3 sm:h-32 sm:w-32"
              >
                {isRecording && <span className="absolute inset-0 animate-ping rounded-full bg-ink/25 [animation-duration:1.6s]" aria-hidden />}
                {recorder.state === 'requesting' ? (
                  <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
                ) : isRecording ? (
                  <Square className="h-7 w-7 fill-current" aria-hidden />
                ) : (
                  <Mic className="h-9 w-9" aria-hidden />
                )}
              </button>
              <p className="mt-5 text-[15px] text-ink-2" aria-live="polite">
                {isRecording ? (
                  <>
                    <span className="font-semibold text-ink tabular-nums">{fmtTime(recorder.elapsed)}</span> of {fmtTime(MAX_RECORDING_SECONDS)} · tap to stop
                  </>
                ) : recorder.state === 'requesting' ? (
                  'Allow microphone access'
                ) : (
                  'Tap to record'
                )}
              </p>

              {/* Live microphone level */}
              <div ref={meterRef} className="mt-8 flex h-16 w-full max-w-[520px] items-center gap-[3px]" aria-hidden>
                {Array.from({ length: METER_BARS }, (_, i) => (
                  <span
                    key={i}
                    data-bar
                    className={`h-full flex-1 origin-center rounded-full transition-transform duration-75 ${isRecording ? 'bg-ink' : 'bg-rule-2'}`}
                    style={{ transform: 'scaleY(0.08)' }}
                  />
                ))}
              </div>

              <RecorderMessage state={recorder.state} />

              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={recording || phase.kind === 'sending'}
                className="mt-8 inline-flex items-center gap-2 text-[14px] font-medium text-ink-2 underline decoration-rule-2 underline-offset-4 hover:text-ink hover:decoration-ink disabled:opacity-40"
              >
                <Upload className="h-4 w-4" aria-hidden /> or upload an audio file
              </button>
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
          )}

          {clipError && (
            <p role="alert" className="mx-auto mt-6 flex max-w-[48ch] items-start justify-center gap-2 text-[14px] text-ink">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {clipError}
            </p>
          )}

          {/* Optional reference text */}
          <div className="mx-auto mt-12 max-w-[520px] text-left">
            <button
              type="button"
              aria-expanded={showReference}
              aria-controls="voice-reference-panel"
              onClick={() => setShowReference((v) => !v)}
              className="flex w-full items-center justify-between gap-4 border-t border-rule-2 py-4 text-[15px] font-medium"
            >
              <span>
                What did you say? <span className="font-normal text-ink-3">Optional</span>
              </span>
              <ChevronDown className={`h-4 w-4 text-ink-3 transition-transform duration-300 ${showReference ? 'rotate-180' : ''}`} aria-hidden />
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
                  placeholder="Type the exact words to compare"
                  className="mb-2 block w-full resize-y rounded-2xl border border-rule-2 bg-paper px-4 py-3 text-[16px] leading-relaxed transition-colors hover:border-ink-3 focus:border-ink focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <div className="mt-8 flex flex-col items-center gap-3">
            {phase.kind === 'sending' ? (
              <div className="flex gap-2">
                <span className="inline-flex h-14 items-center gap-2 rounded-full bg-ink-2 px-8 text-[16px] font-medium text-paper">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Listening…
                </span>
                <button type="button" onClick={cancel} className="h-14 rounded-full border border-rule-2 bg-paper px-6 text-[15px] font-medium hover:border-ink">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-14 items-center rounded-full bg-ink px-10 text-[16px] font-medium text-paper transition-transform duration-150 hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-rule-2 disabled:text-ink-3 disabled:hover:scale-100"
              >
                Show me what AI heard
              </button>
            )}
            <p className="text-[13px] text-ink-3">
              {!clip
                ? 'Record or upload up to a minute of audio.'
                : !configured && service !== 'checking'
                  ? 'Transcription is not available on this server yet.'
                  : 'Sent to ElevenLabs for transcription. VOXELO keeps nothing.'}
            </p>
          </div>
        </form>
      </div>

      {/* Results */}
      <div ref={resultRef} className={`${COLUMN} scroll-mt-20`} aria-live="polite">
        {phase.kind !== 'idle' && (
          <section
            aria-label="Result"
            className={`swap-in mb-12 rounded-[32px] p-7 sm:p-10 ${phase.kind === 'error' ? 'border border-rule-2' : 'bg-ink text-paper'}`}
          >
            <Results phase={phase} reference={reference} onRetry={() => void run()} canRetry={canSubmit} onAddReference={() => setShowReference(true)} />
          </section>
        )}
      </div>

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
  return msg ? <p className="mt-6 max-w-[44ch] text-[14px] text-ink-2">{msg}</p> : null
}

function ServiceNotice({ service }: { service: ServiceStatus | null | 'checking' }) {
  if (service === 'checking' || service?.configured) return null
  return (
    <div role="status" className="mx-auto flex max-w-[780px] items-start gap-2.5 rounded-2xl border border-rule-2 px-5 py-4 text-[14px] text-ink-2">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
      <p>
        {service === null ? (
          <>
            <strong className="font-semibold text-ink">Transcription isn’t available on this deployment.</strong> You can
            still record and play back.
          </>
        ) : (
          <>
            <strong className="font-semibold text-ink">Live transcription is not set up yet.</strong> The server needs an
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
        <p className="mt-4 text-[17px] text-ink-2">{phase.error.message}</p>
        <p className="mt-2 text-[13px] text-ink-3">
          Code <span className="font-mono">{phase.error.code}</span>
          {phase.error.retryAfter ? ` · try again in ${phase.error.retryAfter}s` : ''}
        </p>
        {canRetry && !['not_configured', 'no_endpoint', 'upstream_auth'].includes(phase.error.code) && (
          <button type="button" onClick={onRetry} className="mt-8 inline-flex h-12 items-center gap-2 rounded-full border border-rule-2 px-6 text-[15px] font-medium hover:border-ink">
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
          <dl className="mt-8 grid grid-cols-3 gap-6">
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
