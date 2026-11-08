import { AlertTriangle, FileAudio, Loader2, Mic, RotateCcw, Square, Trash2, Upload } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent, type ReactNode } from 'react'
import { Code } from '../components/EmptyState'
import { Flag } from '../components/Flag'
import { Notes } from '../components/Notes'
import { PageTitle } from '../components/Section'
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

export function VoiceExperience() {
  const [language, setLanguage] = useState('auto')
  const [clip, setClip] = useState<Clip | null>(null)
  const [clipError, setClipError] = useState<string | null>(null)
  const [reference, setReference] = useState('')
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
  useEffect(() => () => {
    if (clipRef.current) URL.revokeObjectURL(clipRef.current.url)
    abortRef.current?.abort()
  }, [])

  const onRecorded = useCallback(
    (blob: Blob) => {
      const err = checkAudio(blob, 'recording.webm')
      setClipError(err)
      replaceClip(err ? null : { blob, url: URL.createObjectURL(blob), name: 'Microphone recording', source: 'recording' })
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
    if (window.matchMedia('(max-width: 1023px)').matches) resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
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
  const recording = recorder.state === 'recording' || recorder.state === 'requesting'
  const canSubmit = !!clip && configured && phase.kind !== 'sending' && !recording

  return (
    <div className="space-y-10 sm:space-y-12">
      <PageTitle
        title="Hear yourself through AI"
        lede="Speak in your language and see exactly what ElevenLabs Scribe recognised. Add what you meant to say and every difference is marked."
      />

      <ServiceNotice service={service} />

      <div className="grid items-start gap-x-14 gap-y-10 lg:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        {/* Controls */}
        <form
          className="space-y-8"
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) void run()
          }}
        >
          <Step n={1} title="Language" htmlFor="voice-language">
            <select
              id="voice-language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              disabled={phase.kind === 'sending'}
              className="h-10 w-full rounded-md border border-rule-2 bg-paper px-3 text-[14px] transition-colors hover:border-ink-3 focus:border-ink focus:outline-none"
            >
              {VOICE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-[13px] text-ink-3">Choosing the language you speak usually gives the most accurate result.</p>
          </Step>

          <Step n={2} title="Your voice">
            {clip && !recording ? (
              <div className="rounded-md border border-rule-2">
                <div className="flex items-center justify-between gap-3 border-b border-rule px-3 py-2.5 text-[14px]">
                  <span className="flex min-w-0 items-center gap-2">
                    {clip.source === 'recording' ? <Mic className="h-4 w-4 shrink-0 text-ink-3" aria-hidden /> : <FileAudio className="h-4 w-4 shrink-0 text-ink-3" aria-hidden />}
                    <span className="truncate">{clip.name}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">{(clip.blob.size / 1024).toFixed(0)} KB</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => replaceClip(null)}
                    disabled={phase.kind === 'sending'}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13px] text-ink-2 hover:bg-wash hover:text-ink disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Remove
                  </button>
                </div>
                <audio controls src={clip.url} className="block h-10 w-full px-1 py-1" aria-label="Play back your audio" />
              </div>
            ) : (
              <div
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
                className={`rounded-md border px-4 py-5 transition-colors ${dragging ? 'border-ink bg-wash' : 'border-rule-2'}`}
              >
                <div className="flex items-center gap-4">
                  {recorder.state === 'recording' ? (
                    <button
                      type="button"
                      onClick={recorder.stop}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-ink px-4 text-[14px] font-medium text-paper hover:bg-ink-2"
                    >
                      <Square className="h-3.5 w-3.5 fill-current" aria-hidden /> Stop
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setClipError(null)
                        void recorder.start()
                      }}
                      disabled={recorder.state === 'unsupported' || recorder.state === 'requesting' || phase.kind === 'sending'}
                      className="inline-flex h-11 shrink-0 items-center gap-2 rounded-md bg-ink px-4 text-[14px] font-medium text-paper hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-rule-2 disabled:text-ink-3"
                    >
                      {recorder.state === 'requesting' ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Mic className="h-4 w-4" aria-hidden />}
                      {recorder.state === 'requesting' ? 'Allow microphone' : 'Record'}
                    </button>
                  )}
                  <div ref={meterRef} className="flex h-9 flex-1 items-center gap-[3px]" aria-hidden>
                    {Array.from({ length: 24 }, (_, i) => (
                      <span
                        key={i}
                        data-bar
                        className={`h-full flex-1 origin-center rounded-[1px] transition-transform duration-75 ${recorder.state === 'recording' ? 'bg-ink' : 'bg-rule-2'}`}
                        style={{ transform: 'scaleY(0.08)' }}
                      />
                    ))}
                  </div>
                  <span className="w-[74px] shrink-0 text-right text-[13px] text-ink-3" aria-live="polite">
                    {recorder.state === 'recording' ? (
                      <>
                        <span className="font-medium text-ink">{fmtTime(recorder.elapsed)}</span> / {fmtTime(MAX_RECORDING_SECONDS)}
                      </>
                    ) : (
                      `max ${fmtTime(MAX_RECORDING_SECONDS)}`
                    )}
                  </span>
                </div>

                <RecorderMessage state={recorder.state} />

                <div className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-rule pt-4 text-[13px] text-ink-3">
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    disabled={recording || phase.kind === 'sending'}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-rule-2 px-2.5 font-medium text-ink hover:border-ink-3 disabled:opacity-40"
                  >
                    <Upload className="h-3.5 w-3.5" aria-hidden /> Upload a file
                  </button>
                  <span>or drop one here. WebM, OGG, MP3, M4A, WAV or FLAC, up to 4 MB.</span>
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
              </div>
            )}
            {clipError && (
              <p role="alert" className="mt-2 flex items-start gap-2 text-[13px] text-ink">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden /> {clipError}
              </p>
            )}
          </Step>

          <Step n={3} title="What you said" optional htmlFor="voice-reference">
            <textarea
              id="voice-reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              rows={3}
              dir="auto"
              placeholder="Type the exact words you spoke"
              className="block w-full resize-y rounded-md border border-rule-2 bg-paper px-3 py-2.5 text-[15px] leading-relaxed transition-colors hover:border-ink-3 focus:border-ink focus:outline-none"
            />
            <p className="mt-1.5 text-[13px] text-ink-3">Needed only for the comparison and error rates. You can add it after transcribing.</p>
          </Step>

          <div className="space-y-3 border-t border-ink pt-5">
            {phase.kind === 'sending' ? (
              <div className="flex gap-2">
                <button type="button" disabled className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-ink-2 text-[14px] font-medium text-paper">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Transcribing
                </button>
                <button type="button" onClick={cancel} className="h-11 rounded-md border border-rule-2 px-4 text-[14px] font-medium hover:border-ink-3">
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="submit"
                disabled={!canSubmit}
                className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-ink text-[14px] font-medium text-paper transition-colors hover:bg-ink-2 disabled:cursor-not-allowed disabled:bg-rule-2 disabled:text-ink-3"
              >
                Transcribe with ElevenLabs
              </button>
            )}
            <p className="text-[12px] leading-relaxed text-ink-3">
              {!clip
                ? 'Record or upload audio to continue.'
                : !configured && service !== 'checking'
                  ? 'Transcription is unavailable until the server is configured.'
                  : 'Your audio is sent to ElevenLabs for transcription. VOXELO does not store it.'}
            </p>
          </div>
        </form>

        {/* Results */}
        <div ref={resultRef} className="scroll-mt-32" aria-live="polite">
          <Results phase={phase} reference={reference} onRetry={() => void run()} canRetry={canSubmit} />
        </div>
      </div>

      <Notes
        flags={phase.kind === 'done' && reference.trim() ? ['C'] : []}
        sources={[
          { label: 'Transcription', value: <>ElevenLabs Scribe, through the server endpoint <Code>/api/transcribe</Code></> },
          { label: 'Privacy', value: 'Audio is processed in memory and discarded. Nothing is written to disk or logged by VOXELO.' },
        ]}
      >
        A single recording does not measure a model’s accuracy for a language. Results vary with microphone, background
        noise, speaking style and the words chosen. Population-level findings come from the Speech Intelligence dataset.
      </Notes>
    </div>
  )
}

function Step({ n, title, optional, htmlFor, children }: { n: number; title: string; optional?: boolean; htmlFor?: string; children: ReactNode }) {
  const Title = htmlFor ? 'label' : 'p'
  return (
    <section className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-2">
      <span className="pt-px font-semibold text-ink-3" aria-hidden>
        {n}
      </span>
      <div>
        <Title {...(htmlFor ? { htmlFor } : {})} className="mb-2 block font-semibold">
          {title}
          {optional && <span className="ml-2 text-[13px] font-normal text-ink-3">Optional</span>}
        </Title>
        {children}
      </div>
    </section>
  )
}

function RecorderMessage({ state }: { state: string }) {
  const msg =
    state === 'denied'
      ? 'Microphone access was blocked. Allow it in your browser’s site settings, or upload a file instead.'
      : state === 'unsupported'
        ? 'Recording is not available in this browser or on an insecure connection. Upload a file instead.'
        : state === 'error'
          ? 'No microphone could be opened. Check that one is connected, or upload a file.'
          : null
  return msg ? <p className="mt-3 text-[13px] text-ink-2">{msg}</p> : null
}

function ServiceNotice({ service }: { service: ServiceStatus | null | 'checking' }) {
  if (service === 'checking' || service?.configured) return null
  return (
    <div role="status" className="flex items-start gap-2.5 rounded-md border border-rule-2 bg-wash px-4 py-3 text-[14px] text-ink-2">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-3" aria-hidden />
      <p>
        {service === null ? (
          <>
            <strong className="font-semibold text-ink">Transcription endpoint not available.</strong> This deployment
            has no <Code>/api/transcribe</Code> server function. Recording and upload still work; transcription does not.
          </>
        ) : (
          <>
            <strong className="font-semibold text-ink">Live transcription is not configured.</strong> The server has no
            ElevenLabs API key, so recordings cannot be transcribed yet. Set <Code>ELEVENLABS_API_KEY</Code> on the
            server to enable it.
          </>
        )}
      </p>
    </div>
  )
}

function Results({ phase, reference, onRetry, canRetry }: { phase: Phase; reference: string; onRetry: () => void; canRetry: boolean }) {
  const hyp = phase.kind === 'done' ? phase.result.text : ''
  const ref = reference.trim()
  const comparison = useMemo(() => {
    if (phase.kind !== 'done' || !ref) return null
    const tokens = diffWords(ref, hyp)
    return { tokens, s: summarise(tokens), cer: charErrorRate(ref, hyp) }
  }, [phase.kind, ref, hyp])

  if (phase.kind === 'idle')
    return (
      <div className="rounded-lg border border-dashed border-rule-2 bg-wash px-6 py-10">
        <p className="text-[19px] font-semibold tracking-[-0.01em]">What AI heard appears here</p>
        <p className="mt-2 max-w-[52ch] text-ink-2">
          Choose a language, record a sentence or upload a clip, then transcribe. Add the words you said to see every
          substitution, omission and insertion marked.
        </p>
      </div>
    )

  if (phase.kind === 'sending')
    return (
      <div className="rounded-lg border border-rule-2 px-6 py-8" aria-busy="true">
        <p className="flex items-center gap-2 text-[14px] text-ink-2">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending to ElevenLabs Scribe
        </p>
        <div className="mt-5 space-y-3">
          <div className="h-5 w-11/12 animate-pulse rounded bg-wash" />
          <div className="h-5 w-3/4 animate-pulse rounded bg-wash" />
        </div>
      </div>
    )

  if (phase.kind === 'error')
    return (
      <div role="alert" className="rounded-lg border border-ink px-6 py-6">
        <p className="flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4" aria-hidden /> Transcription failed
        </p>
        <p className="mt-1.5 max-w-[60ch] text-ink-2">{phase.error.message}</p>
        <p className="mt-1 text-[12px] text-ink-3">
          Code: <span className="font-mono">{phase.error.code}</span>
          {phase.error.retryAfter ? ` · retry after ${phase.error.retryAfter}s` : ''}
        </p>
        {canRetry && !['not_configured', 'no_endpoint', 'upstream_auth'].includes(phase.error.code) && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-rule-2 px-3 text-[14px] font-medium hover:border-ink-3"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Try again
          </button>
        )}
      </div>
    )

  const { result, language } = phase
  const detected = result.language_code
  const mismatch = language !== 'auto' && detected && !detected.startsWith(language) && !language.startsWith(detected)

  return (
    <article className="space-y-8">
      <section>
        <h2 className="text-xl font-semibold tracking-[-0.015em]">What AI heard</h2>
        <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
          <Meta label="Selected">{languageName(language)}</Meta>
          <Meta label="Detected">
            {detected ? languageName(detected) : 'n/a'}
            {result.language_probability !== null && <span className="text-ink-3"> · {pct(result.language_probability, 0)} confidence</span>}
          </Meta>
          <Meta label="Model">
            <span className="font-mono text-[12px]">{result.model}</span>
          </Meta>
        </dl>
        <div className="mt-4 rounded-lg border border-rule-2 px-5 py-5">
          {result.text.trim() ? (
            <p dir="auto" className="text-[20px] leading-[1.6]">
              {result.text}
            </p>
          ) : (
            <p className="text-ink-2">No speech was recognised in this recording.</p>
          )}
        </div>
        {mismatch && (
          <p className="mt-2 text-[13px] text-ink-2">
            The detected language differs from the one you selected. The recording may contain another language, or
            recognition may be uncertain.
          </p>
        )}
      </section>

      <section>
        <h2 className="text-xl font-semibold tracking-[-0.015em]">Said and heard</h2>
        {comparison ? (
          <>
            <div className="mt-4 rounded-lg border border-rule-2">
              <div className="px-5 py-5">
                <ProofLines tokens={comparison.tokens} size="lg" />
              </div>
              <div className="border-t border-rule px-5 py-3">
                <DiffLegend />
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 border-y border-ink sm:grid-cols-4">
              <Metric label="Word Error Rate" value={comparison.s.wer === null ? 'n/a' : pct(comparison.s.wer)} />
              <Metric label="Character Error Rate" value={comparison.cer === null ? 'n/a' : pct(comparison.cer)} />
              <Metric label="Words compared" value={String(comparison.s.refWords)} plain />
              <Metric
                label="Differences"
                value={String(comparison.s.errors)}
                hint={`${comparison.s.substitutions} sub · ${comparison.s.deletions} missed · ${comparison.s.insertions} added`}
                plain
              />
            </dl>
          </>
        ) : (
          <p className="mt-2 max-w-[60ch] text-ink-2">
            Type what you said in step 3 to compare it word by word with the transcript. Error rates are shown only when
            there is a reference to compare against.
          </p>
        )}
      </section>

      <p className="max-w-[68ch] border-l border-rule-2 pl-4 text-[14px] leading-relaxed text-ink-2">
        One recording is a demonstration, not a measurement. It cannot show how accurately ElevenLabs recognises a
        language overall; that needs many speakers and recordings, as in the Speech Intelligence results.
      </p>
    </article>
  )
}

function Meta({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-1.5">
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

function Metric({ label, value, hint, plain }: { label: string; value: string; hint?: string; plain?: boolean }) {
  return (
    <div className="flex flex-col-reverse justify-end border-rule py-3 pr-3 odd:pr-3 even:border-l even:pl-3 sm:border-l sm:pl-3 sm:first:border-l-0 sm:first:pl-0 [&:nth-child(n+3)]:border-t sm:[&:nth-child(n+3)]:border-t-0">
      <dt className="mt-1.5 text-[13px] text-ink-3">
        {label}
        {hint && <span className="block text-[12px]">{hint}</span>}
      </dt>
      <dd className="text-[22px] leading-none font-semibold tracking-[-0.02em]">
        {value}
        {!plain && value !== 'n/a' && <Flag kind="C" />}
      </dd>
    </div>
  )
}
