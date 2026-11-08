import {
  AlertTriangle,
  AudioLines,
  Bus,
  Car,
  Check,
  CircleHelp,
  Construction,
  Droplets,
  Gavel,
  Languages,
  Lightbulb,
  Loader2,
  MapPin,
  PawPrint,
  Play,
  RotateCcw,
  Siren,
  Snowflake,
  SprayCan,
  TrafficCone,
  Trash2,
  TreePine,
  Upload,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { useCallback, useEffect, useEffectEvent, useRef, useState, type ChangeEvent, type ReactNode } from 'react'
import { MeterBand, Orb } from '../components/voice/Recorder'
import { useRecorder } from '../hooks/useRecorder'
import {
  ASSISTANT_LANGUAGES,
  AssistantError,
  DRAFT_CATEGORIES,
  RESPONSIBLE_LABELS,
  classifyRequest,
  converse,
  findLanguage,
  getAssistantStatus,
  htmlLang,
  isSupported,
  languageLabel,
  normalizeLanguage,
  planConfirmation,
  prefetch,
  say,
  silentWavUrl,
  type AssistantStatus,
  type ConfirmPlan,
  type Draft,
  type HistoryItem,
  type SayRequest,
} from '../lib/assistant'
import { fmtTime } from '../lib/format'
import { MAX_RECORDING_SECONDS, TranscriptionError, checkAudio, transcribe } from '../lib/voice'

// ------------------------------------------------------------------ types

type Stage = 'request' | 'working' | 'confirm' | 'answer' | 'done'
/** "llm": conversation through the language model. "template": fixed lines from live_demo.py. */
type Mode = 'llm' | 'template'

interface CallerTurn {
  id: number
  who: 'caller'
  kind: 'request' | 'answer'
  text: string
  lang: string
  /** Detection on the first pass, before the caller confirmed. */
  detected?: { code: string; probability: number | null }
  /** What the first pass heard, kept when the caller's language changed the transcript. */
  firstPass?: { text: string; code: string }
  confirmed?: boolean
}

interface AssistantTurn {
  id: number
  who: 'assistant'
  status: 'loading' | 'ready' | 'failed'
  text?: string
  parts?: { text: string; lang: string }[]
  gloss?: string
  lang?: string
  /** undefined while the voice is still being prepared; null when there is no voice. */
  audioUrl?: string | null
  note?: string
}

type Turn = CallerTurn | AssistantTurn

interface Ticket {
  lang?: string
  langSource?: 'detected' | 'confirmed'
  /** The caller's own first words, in their language. */
  request?: string
  /** Keyword category, used when there is no language model. */
  keywordCategory?: { id: string; label: string }
  /** Fallback flow only: the address as heard. */
  address?: string
}

interface Problem {
  message: string
  retry?: () => void
}

const CATEGORY_ICON: Record<string, LucideIcon> = {
  streetlight: Lightbulb,
  road: Construction,
  sidewalk: Construction,
  traffic: TrafficCone,
  garbage: Trash2,
  noise: Volume2,
  water: Droplets,
  drainage: Droplets,
  bylaw: Gavel,
  transit: Bus,
  parking: Car,
  trees: TreePine,
  graffiti: SprayCan,
  animal: PawPrint,
  snow: Snowflake,
  other: CircleHelp,
}

const URGENCY_LABEL: Record<Draft['urgency'], string> = { routine: 'Routine', soon: 'Soon', urgent: 'Urgent: safety hazard' }

const STEPS = ['Request', 'Language', 'Details', 'Draft'] as const
const STAGE = 'mx-auto w-full max-w-[1120px] px-5 sm:px-8'

const isAbort = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'
const messageOf = (e: unknown) =>
  e instanceof TranscriptionError || e instanceof AssistantError ? e.message : 'Something went wrong. Try again.'

// ------------------------------------------------------------------ page

export function Assistant() {
  const [stage, setStage] = useState<Stage>('request')
  const [step, setStep] = useState(0)
  const [busy, setBusy] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [ticket, setTicket] = useState<Ticket>({})
  const [draft, setDraft] = useState<Draft | null>(null)
  const [emergency, setEmergency] = useState(false)
  const [plan, setPlan] = useState<ConfirmPlan | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)
  const [service, setService] = useState<AssistantStatus | 'checking' | null>('checking')
  const [mode, setModeState] = useState<Mode>('template')
  const [speaking, setSpeaking] = useState<number | null>(null)
  const [blocked, setBlocked] = useState<number | null>(null)

  const meterRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const unlocked = useRef(false)
  const abortRef = useRef<AbortController | null>(null)
  const session = useRef(0)
  const nextId = useRef(1)
  const stageRef = useRef<Stage>('request')
  const modeRef = useRef<Mode>('template')
  const llmAvailable = useRef(false)
  const requestClip = useRef<{ blob: Blob; name: string } | null>(null)
  const requestTurnId = useRef(0)
  const firstHeard = useRef('')
  const langRef = useRef('eng')
  /** The conversation the language model sees: caller transcripts and its own replies. */
  const history = useRef<HistoryItem[]>([])
  const endRef = useRef<HTMLDivElement>(null)
  /** Where Cancel returns to while a request is in flight. */
  const resumeRef = useRef<Stage>('request')

  const go = (s: Stage) => {
    stageRef.current = s
    setStage(s)
  }
  const work = (label: string) => {
    if (stageRef.current !== 'working') resumeRef.current = stageRef.current
    setBusy(label)
    go('working')
  }
  const setMode = (m: Mode) => {
    modeRef.current = m
    setModeState(m)
  }

  // ---------------------------------------------------------------- service and audio

  useEffect(() => {
    const ac = new AbortController()
    getAssistantStatus(ac.signal).then((s) => {
      if (ac.signal.aborted) return
      setService(s)
      llmAvailable.current = !!s?.llm
      setMode(s?.llm ? 'llm' : 'template')
    })
    return () => ac.abort()
  }, [])

  // Leaving the page: stop whatever is in flight and drop late results.
  const endCall = useEffectEvent(() => {
    abortRef.current?.abort()
    session.current++
  })

  useEffect(() => {
    const audio = new Audio()
    audio.preload = 'auto'
    const clear = () => setSpeaking(null)
    audio.addEventListener('ended', clear)
    audio.addEventListener('pause', clear)
    audioRef.current = audio
    return () => {
      audio.pause()
      audio.removeEventListener('ended', clear)
      audio.removeEventListener('pause', clear)
      endCall()
    }
  }, [])

  /** Call inside a tap: lets later replies play after an async wait on stricter browsers. */
  const unlockAudio = () => {
    const audio = audioRef.current
    if (unlocked.current || !audio) return
    unlocked.current = true
    audio.src = silentWavUrl()
    audio.play().catch(() => {})
  }

  const play = useCallback((id: number, url: string) => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    audio.src = url
    audio.currentTime = 0
    setBlocked(null)
    audio
      .play()
      .then(() => setSpeaking(id))
      .catch(() => setBlocked(id)) // autoplay refused: the turn shows a play button instead
  }, [])

  const stopSpeaking = () => audioRef.current?.pause()

  // Keep the newest turn and the controls in view as the call goes on (not on first load).
  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [turns.length, stage])

  // ---------------------------------------------------------------- conversation helpers

  const addTurn = (t: Omit<CallerTurn, 'id'> | Omit<AssistantTurn, 'id'>) => {
    const id = nextId.current++
    setTurns((ts) => [...ts, { ...t, id } as Turn])
    return id
  }
  const patchTurn = (id: number, patch: Partial<CallerTurn> | Partial<AssistantTurn>) =>
    setTurns((ts) => ts.map((t) => (t.id === id ? ({ ...t, ...patch } as Turn) : t)))

  /** Fetch the voice for a turn and play it. The text is already on screen. */
  const voice = async (id: number, req: SayRequest, note?: string) => {
    const mine = session.current
    try {
      const r = await say(req)
      if (mine !== session.current) return
      patchTurn(id, { audioUrl: r.audioUrl, note: [note, r.audioError].filter(Boolean).join(' ') || undefined })
      if (r.audioUrl) play(id, r.audioUrl)
    } catch (e) {
      if (mine !== session.current) return
      patchTurn(id, { audioUrl: null, note: [note, messageOf(e)].filter(Boolean).join(' ') })
    }
  }

  /** A fixed line: placeholder turn first, then text and voice together. */
  const speakLine = async (req: SayRequest, note?: string) => {
    const mine = session.current
    const id = addTurn({ who: 'assistant', status: 'loading', note })
    try {
      const r = await say(req)
      if (mine !== session.current) return
      patchTurn(id, {
        status: 'ready',
        text: r.text,
        parts: r.parts,
        gloss: r.gloss,
        lang: r.lang,
        audioUrl: r.audioUrl,
        note: [note, r.audioError].filter(Boolean).join(' ') || undefined,
      })
      if (r.audioUrl) play(id, r.audioUrl)
    } catch (e) {
      if (mine !== session.current) return
      patchTurn(id, { status: 'failed', note: messageOf(e) })
    }
  }

  const listen = async (blob: Blob, language: string, name: string) => {
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    const res = await transcribe(blob, language, ac.signal, name)
    return { res, aborted: ac.signal.aborted }
  }

  const replyLang = () => (isSupported(langRef.current) ? langRef.current : 'eng')

  // ---------------------------------------------------------------- flow

  /** Step 1: the caller describes the problem; Scribe detects the language. */
  const submitRequest = async (blob: Blob, name: string) => {
    const mine = session.current
    requestClip.current = { blob, name }
    setProblem(null)
    work('Listening…')
    try {
      const { res, aborted } = await listen(blob, 'auto', name)
      if (aborted || mine !== session.current) return
      const text = res.text.trim()
      if (!text) {
        go('request')
        setProblem({ message: 'I didn’t catch anything. Tap the microphone and try again, a little closer.' })
        return
      }
      const code = normalizeLanguage(res.language_code) ?? 'eng'
      const probability = res.language_probability
      firstHeard.current = text
      requestTurnId.current = addTurn({ who: 'caller', kind: 'request', text, lang: code, detected: { code, probability } })

      const next = planConfirmation(code, probability)
      if (next) {
        setPlan(next)
        setShowAll(false)
        setStep(1)
        go('confirm')
        // Fallback flow: warm the reply in each offered language so it plays at once after the tap.
        if (modeRef.current === 'template') next.options.forEach((o) => prefetch({ line: 'reply', lang: o }))
        void speakLine({ line: 'confirm', pair: next.pair })
      } else {
        start(code, text, 'detected')
      }
    } catch (e) {
      if (isAbort(e) || mine !== session.current) return
      go('request')
      setProblem({ message: messageOf(e), retry: () => void submitRequest(blob, name) })
    }
  }

  /** Step 2: the caller names their language; the same audio is transcribed again in it. */
  const chooseLanguage = async (code: string) => {
    const clip = requestClip.current
    if (!clip) return
    stopSpeaking()
    unlockAudio()
    const mine = session.current
    setProblem(null)
    work(`Listening again in ${languageLabel(code)}…`)
    try {
      const { res, aborted } = await listen(clip.blob, code, clip.name)
      if (aborted || mine !== session.current) return
      // If the second pass hears nothing, keep the first transcript.
      const text = res.text.trim() || firstHeard.current
      setTurns((ts) =>
        ts.map((t) => {
          if (t.id !== requestTurnId.current || t.who !== 'caller') return t
          const changed = text !== t.text
          return { ...t, text, lang: code, confirmed: true, firstPass: changed ? { text: t.text, code: t.lang } : t.firstPass }
        }),
      )
      start(code, text, 'confirmed')
    } catch (e) {
      if (isAbort(e) || mine !== session.current) return
      go('confirm')
      setProblem({ message: messageOf(e), retry: () => void chooseLanguage(code) })
    }
  }

  /** Step 3: the language is settled. Start the conversation (or the fallback flow). */
  const start = (code: string, text: string, source: 'detected' | 'confirmed') => {
    langRef.current = code
    history.current = [{ role: 'caller', text }]
    setTicket({ lang: code, langSource: source, request: text, keywordCategory: classifyRequest(text) })
    setStep(2)
    const note = replyLang() !== code ? `${languageLabel(code)} replies aren’t in this prototype yet, so the assistant answers in English.` : undefined
    if (modeRef.current === 'llm') void runTurn(note)
    else askAddress(note)
  }

  /** One turn with the language model: show its reply at once, then its voice. */
  const runTurn = async (note?: string) => {
    const mine = session.current
    work('Thinking…')
    abortRef.current?.abort()
    const ac = new AbortController()
    abortRef.current = ac
    try {
      const r = await converse(replyLang(), history.current, ac.signal)
      if (ac.signal.aborted || mine !== session.current) return
      history.current.push({ role: 'assistant', text: r.reply })
      // Keep the draft built so far if this turn had none (a side question mid-call).
      if (r.draft) setDraft(r.draft)
      if (r.emergency) setEmergency(true)
      const id = addTurn({
        who: 'assistant',
        status: 'ready',
        text: r.reply,
        parts: [{ text: r.reply, lang: r.speech.lang }],
        gloss: r.replyEn,
        lang: r.speech.lang,
        audioUrl: undefined,
        note,
      })
      if (r.status === 'ready' || r.status === 'closed') finish()
      else {
        setStep(2)
        go('answer')
      }
      void voice(id, { line: 'text', ...r.speech }, note)
    } catch (e) {
      if (isAbort(e) || mine !== session.current) return
      // No model answered: carry on with the fixed-line flow rather than stopping the call.
      setMode('template')
      const fallbackNote = 'The AI conversation is unavailable right now, so the assistant switched to its simple flow.'
      const callerTurns = history.current.filter((h) => h.role === 'caller').length
      if (callerTurns <= 1) askAddress(fallbackNote)
      else {
        // The latest answer most likely completes the location; finish with what we have.
        const last = history.current[history.current.length - 1]
        setTicket((t) => ({ ...t, address: last?.text }))
        finish()
        void speakLine({ line: 'done', lang: replyLang() }, fallbackNote)
      }
    }
  }

  /** Fallback flow: fixed reply, ask for the address. */
  const askAddress = (note?: string) => {
    setStep(2)
    go('answer')
    prefetch({ line: 'done', lang: replyLang() })
    void speakLine({ line: 'reply', lang: replyLang() }, note)
  }

  const finish = () => {
    setStep(STEPS.length)
    go('done')
  }

  /** The caller answers a follow-up question (or gives the address in the fallback flow). */
  const submitAnswer = async (blob: Blob, name: string) => {
    const mine = session.current
    setProblem(null)
    work('Listening…')
    try {
      const { res, aborted } = await listen(blob, langRef.current, name)
      if (aborted || mine !== session.current) return
      const text = res.text.trim()
      if (!text) {
        go('answer')
        setProblem({ message: 'I didn’t catch that. Tap the microphone and say it again.' })
        return
      }
      addTurn({ who: 'caller', kind: 'answer', text, lang: langRef.current })
      if (modeRef.current === 'llm') {
        history.current.push({ role: 'caller', text })
        void runTurn()
      } else {
        setTicket((t) => ({ ...t, address: text }))
        finish()
        void speakLine({ line: 'done', lang: replyLang() })
      }
    } catch (e) {
      if (isAbort(e) || mine !== session.current) return
      go('answer')
      setProblem({ message: messageOf(e), retry: () => void submitAnswer(blob, name) })
    }
  }

  const onClip = (blob: Blob, name: string) => {
    const err = checkAudio(blob, name)
    if (err) return setProblem({ message: err })
    if (stageRef.current === 'request') void submitRequest(blob, name)
    else if (stageRef.current === 'answer') void submitAnswer(blob, name)
  }

  const recorder = useRecorder((blob) => onClip(blob, 'recording.webm'), meterRef)

  const cancel = () => {
    abortRef.current?.abort()
    setProblem(null)
    go(resumeRef.current)
  }

  const reset = () => {
    session.current++
    abortRef.current?.abort()
    stopSpeaking()
    requestClip.current = null
    history.current = []
    setTurns([])
    setTicket({})
    setDraft(null)
    setEmergency(false)
    setPlan(null)
    setProblem(null)
    setBlocked(null)
    setStep(0)
    // A model that failed during the last call gets another chance.
    setMode(llmAvailable.current ? 'llm' : 'template')
    go('request')
  }

  // ---------------------------------------------------------------- render

  const isRecording = recorder.state === 'recording'
  const recording = isRecording || recorder.state === 'requesting'
  const unavailable = service === null || (service !== 'checking' && !service.configured)
  const canRecord = (stage === 'request' || stage === 'answer') && !unavailable
  const model = service !== 'checking' && service?.model ? service.model.replace(/^openai\//, '') : null
  const lastAssistantAsks = mode === 'llm'

  return (
    <>
      <section aria-label="311 Assistant" className="voice-atmosphere relative overflow-hidden bg-ink pt-12 pb-16 text-paper sm:pt-16 sm:pb-20">
        <div className={STAGE}>
          <header className="text-center">
            <p className="text-[12px] font-medium tracking-[0.14em] text-[rgb(176_228_255/0.8)] uppercase">VOXELO 311 Assistant · Mississauga</p>
            <h1 className="mt-4 text-[clamp(2.1rem,5vw,3.6rem)] leading-[1] font-semibold tracking-[-0.04em]">Mississauga city services, in your language.</h1>
            <p className="mx-auto mt-4 max-w-[50ch] text-[17px] text-white/60">
              Report a pothole on Hurontario or a streetlight out in Malton, or ask how a city service works, in any language. VOXELO checks your language, asks what City staff would need, and prepares an English 311 request draft.
            </p>
          </header>

          {unavailable && (
            <p role="status" className="mx-auto mt-8 flex max-w-[52ch] items-start justify-center gap-2 text-center text-[14px] text-white/70">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              {service === null
                ? 'The assistant endpoint is not available on this deployment.'
                : 'The assistant needs ELEVENLABS_API_KEY on the server. Add it to .env.local (or the Vercel settings) and restart.'}
            </p>
          )}

          <div className="mt-10 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10">
            {/* Conversation and controls */}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <Steps current={step} />
              </div>

              {emergency && (
                <div role="alert" className="swap-in mt-6 flex items-start gap-3 rounded-2xl bg-proof px-5 py-4 text-paper">
                  <Siren className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
                  <p className="text-[15px] leading-snug">
                    <strong className="font-semibold">If anyone is in danger, call 911 now.</strong> Mississauga 311 is for non-emergency city services.
                  </p>
                </div>
              )}

              <ol aria-live="polite" className="mt-6 flex flex-col gap-4">
                {turns.map((t) =>
                  t.who === 'caller' ? (
                    <CallerBubble key={t.id} turn={t} />
                  ) : (
                    <AssistantBubble
                      key={t.id}
                      turn={t}
                      speaking={speaking === t.id}
                      blocked={blocked === t.id}
                      onPlay={() => t.audioUrl && play(t.id, t.audioUrl)}
                    />
                  ),
                )}
              </ol>

              <div ref={endRef} className="scroll-mb-8">
                {/* Recorder: the request, then each answer */}
                {(stage === 'request' || stage === 'answer') && (
                  <div className={turns.length ? 'mt-8' : 'mt-2'}>
                    <div className="relative mx-auto grid min-h-44 place-items-center sm:min-h-52">
                      <MeterBand meterRef={meterRef} isRecording={isRecording} dimmed={false} />
                      <div className="relative flex justify-center py-2">
                        <Orb
                          state={recorder.state}
                          isRecording={isRecording}
                          progress={Math.min(1, recorder.elapsed / MAX_RECORDING_SECONDS)}
                          disabled={!canRecord || recorder.state === 'unsupported' || recorder.state === 'requesting'}
                          onClick={() => {
                            if (isRecording) {
                              unlockAudio()
                              return recorder.stop()
                            }
                            // Stop first: pausing after the unlock would cancel it.
                            stopSpeaking()
                            unlockAudio()
                            setProblem(null)
                            void recorder.start()
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-1 flex flex-col items-center text-center" aria-live="polite">
                      <p className="text-[17px] text-white/75">
                        {isRecording ? (
                          <>
                            <span className="font-semibold text-paper tabular-nums">{fmtTime(recorder.elapsed)}</span>
                            <span className="text-white/45"> · tap to stop</span>
                          </>
                        ) : recorder.state === 'requesting' ? (
                          'Allow microphone access'
                        ) : stage === 'request' ? (
                          'Tap and describe the problem'
                        ) : lastAssistantAsks ? (
                          'Tap to answer'
                        ) : (
                          'Tap and say the address'
                        )}
                      </p>
                      {stage === 'request' && !recording && (
                        <p className="mt-2 text-[14px] text-white/45">“The streetlight outside 45 Hurontario Street is out”, in any language</p>
                      )}
                      <RecorderNote state={recorder.state} />
                      <button
                        type="button"
                        onClick={() => {
                          unlockAudio()
                          fileRef.current?.click()
                        }}
                        disabled={recording || !canRecord}
                        className="mt-4 inline-flex items-center gap-2 text-[13px] font-medium text-white/45 underline decoration-white/20 underline-offset-4 transition-colors hover:text-paper hover:decoration-white/60 disabled:opacity-40"
                      >
                        <Upload className="h-3.5 w-3.5" aria-hidden /> or upload a recording
                      </button>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="audio/*,.webm,.ogg,.mp3,.m4a,.wav,.flac"
                        className="sr-only"
                        tabIndex={-1}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const f = e.target.files?.[0]
                          if (f) onClip(f, f.name)
                          e.target.value = ''
                        }}
                      />
                    </div>
                  </div>
                )}

                {stage === 'working' && (
                  <div className="mt-8 flex justify-center gap-2">
                    <span className="inline-flex h-12 items-center gap-2.5 rounded-full bg-white/10 px-6 text-[15px] font-medium">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {busy}
                    </span>
                    <button type="button" onClick={cancel} className="h-12 rounded-full px-5 text-[14px] font-medium text-white/60 ring-1 ring-white/15 transition-colors hover:text-paper hover:ring-white/40">
                      Cancel
                    </button>
                  </div>
                )}

                {stage === 'confirm' && plan && (
                  <LanguageChoice plan={plan} showAll={showAll} onShowAll={() => setShowAll(true)} onChoose={(c) => void chooseLanguage(c)} />
                )}

                {stage === 'done' && (
                  <div className="swap-in mt-8 flex justify-center">
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex h-12 items-center gap-2 rounded-full bg-paper px-6 text-[15px] font-medium text-ink transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden /> Start a new call
                    </button>
                  </div>
                )}

                {problem && (
                  <div role="alert" className="swap-in mx-auto mt-6 flex max-w-[520px] items-start gap-3 rounded-2xl bg-white/[0.06] p-4 text-[14px] ring-1 ring-white/12">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[rgb(176_228_255)]" aria-hidden />
                    <p className="flex-1 text-white/85">{problem.message}</p>
                    {problem.retry && (
                      <button type="button" onClick={problem.retry} className="shrink-0 font-medium text-paper underline underline-offset-4">
                        Try again
                      </button>
                    )}
                  </div>
                )}

                {stage !== 'request' && stage !== 'done' && (
                  <div className="mt-6 flex justify-center">
                    <button type="button" onClick={reset} className="text-[13px] text-white/40 underline decoration-white/15 underline-offset-4 hover:text-white/80">
                      Start over
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* What the city would receive */}
            <DraftCard ticket={ticket} draft={draft} done={stage === 'done'} model={mode === 'llm' ? model : null} />
          </div>
        </div>
      </section>

      <section aria-label="How the assistant works" className="bg-paper">
        <div className="mx-auto grid max-w-[1120px] gap-10 px-5 py-16 sm:px-8 sm:py-20 md:grid-cols-2">
          <div>
            <p className="text-[12px] font-medium tracking-[0.14em] text-ink-3 uppercase">Why it asks your language</p>
            <h2 className="mt-3 text-[clamp(1.6rem,3vw,2.2rem)] leading-[1.1] font-semibold tracking-[-0.03em]">Confidence isn’t enough. So it asks.</h2>
            <p className="mt-4 max-w-[52ch] text-ink-2">
              In our FLEURS tests, every time Scribe wrote Urdu as Hindi it was 91–99% sure, and it labelled all 40 Cantonese clips as Chinese.
              A confidence threshold would not catch these mistakes. For languages that get confused with each other, the assistant always asks. For the rest it asks only when detection is unsure.
            </p>
          </div>
          <dl className="grid content-start gap-5 sm:grid-cols-2">
            <Stat value="24% → 4%" label="Urdu character error rate: auto-detected vs language specified" />
            <Stat value="8 of 40" label="Urdu clips written as Hindi, all with ≥ 91% confidence" />
            <Stat value="40 of 40" label="Cantonese clips detected as generic Chinese" />
            <Stat value="15" label="languages the assistant can answer in" />
          </dl>
        </div>
      </section>
    </>
  )
}

// ------------------------------------------------------------------ pieces

function Steps({ current }: { current: number }) {
  return (
    <ol className="flex items-center gap-2 text-[13px]" aria-label="Call progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span
            className={`grid h-6 w-6 place-items-center rounded-full text-[11px] font-semibold transition-colors duration-300 ${
              i < current ? 'bg-[rgb(176_228_255)] text-ink' : i === current ? 'bg-paper text-ink' : 'bg-white/10 text-white/50'
            }`}
          >
            {i < current ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
          </span>
          <span className={i === current ? 'font-medium text-paper' : 'hidden text-white/45 sm:inline'}>{s}</span>
          {i < STEPS.length - 1 && <span aria-hidden className="h-px w-4 bg-white/15 sm:w-6" />}
        </li>
      ))}
    </ol>
  )
}

function CallerBubble({ turn }: { turn: CallerTurn }) {
  const p = turn.detected?.probability
  return (
    <li className="swap-in flex justify-end">
      <div className="max-w-[88%] rounded-[22px] rounded-br-md bg-paper px-5 py-4 text-ink sm:max-w-[80%]">
        <p className="text-[12px] font-medium text-ink-3">You</p>
        {turn.firstPass && (
          <p className="mt-1.5 text-[14px] text-ink-3">
            <span className="text-[12px] font-medium">First heard as {languageLabel(turn.firstPass.code)}: </span>
            <span dir="auto" lang={htmlLang(turn.firstPass.code)} className="line-through decoration-proof/70">
              {turn.firstPass.text}
            </span>
          </p>
        )}
        <p dir="auto" lang={htmlLang(turn.lang)} className="mt-1 text-[18px] leading-snug">
          {turn.text}
        </p>
        {turn.kind === 'request' && (
          <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-ink-3">
            <Languages className="h-3.5 w-3.5" aria-hidden />
            {turn.confirmed ? (
              <span className="font-medium text-ink">{languageLabel(turn.lang)} · confirmed by you</span>
            ) : (
              <span>
                Detected {languageLabel(turn.detected?.code)}
                {typeof p === 'number' && ` · ${Math.round(p * 100)}% sure`}
              </span>
            )}
          </p>
        )}
      </div>
    </li>
  )
}

function AssistantBubble({ turn, speaking, blocked, onPlay }: { turn: AssistantTurn; speaking: boolean; blocked: boolean; onPlay: () => void }) {
  const multi = turn.lang === 'mul'
  return (
    <li className="swap-in flex gap-3">
      <span aria-hidden className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/15">
        <AudioLines className={`h-4 w-4 text-[rgb(176_228_255)] ${speaking ? 'animate-pulse' : ''}`} />
      </span>
      <div className="min-w-0 max-w-[88%] rounded-[22px] rounded-tl-md bg-white/[0.07] px-5 py-4 ring-1 ring-white/10 sm:max-w-[80%]">
        <p className="flex items-center gap-2 text-[12px] font-medium text-white/50">
          Assistant{turn.lang && !multi && turn.status === 'ready' && ` · ${languageLabel(turn.lang)}`}
          {speaking && <SpeakingBars />}
        </p>
        {turn.status === 'loading' ? (
          <p className="mt-2 flex items-center gap-2 text-[15px] text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing a reply…
          </p>
        ) : turn.status === 'failed' ? (
          <p className="mt-1.5 text-[15px] text-white/70">{turn.note ?? 'The reply could not be prepared.'}</p>
        ) : (
          <>
            {/* One line per language: right-to-left and left-to-right scripts never share a line. */}
            {(turn.parts ?? [{ text: turn.text ?? '', lang: turn.lang ?? 'eng' }]).map((p, i) => (
              <p key={i} dir="auto" lang={htmlLang(p.lang)} className="mt-1 text-[18px] leading-snug text-paper">
                {p.text}
              </p>
            ))}
            {turn.gloss && turn.lang !== 'eng' && <p className="mt-1.5 text-[14px] text-white/50">{turn.gloss}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {turn.audioUrl === undefined ? (
                <span className="inline-flex h-8 items-center gap-1.5 text-[13px] text-white/45">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Preparing voice…
                </span>
              ) : (
                turn.audioUrl && (
                  <button
                    type="button"
                    onClick={onPlay}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium transition-colors ${
                      blocked ? 'bg-paper text-ink' : 'bg-white/10 text-white/75 hover:bg-white/15 hover:text-paper'
                    }`}
                  >
                    <Play className="h-3.5 w-3.5 fill-current" aria-hidden /> {blocked ? 'Play reply' : 'Replay'}
                  </button>
                )
              )}
              {turn.note && <span className="text-[12px] text-white/45">{turn.note}</span>}
            </div>
          </>
        )}
      </div>
    </li>
  )
}

function SpeakingBars() {
  return (
    <span aria-label="Speaking" className="inline-flex h-3 items-center gap-[2px]">
      {[0.2, 0.9, 0.5, 1.3].map((d) => (
        <span key={d} className="wave-bar block h-3 w-[2px] rounded-full bg-[rgb(176_228_255)]" style={{ ['--d' as string]: d }} />
      ))}
    </span>
  )
}

function LanguageChoice({ plan, showAll, onShowAll, onChoose }: { plan: ConfirmPlan; showAll: boolean; onShowAll: () => void; onChoose: (code: string) => void }) {
  const rest = ASSISTANT_LANGUAGES.filter((l) => !plan.options.includes(l.code))
  return (
    <div className="swap-in mx-auto mt-8 max-w-[560px] text-center">
      <p className="text-[17px] font-medium">Which language are you speaking?</p>
      <p className="mt-1 text-[14px] text-white/50">
        {plan.reason === 'confusable'
          ? 'Speech AI often mixes these up, so the assistant checks.'
          : 'The assistant wasn’t sure which language it heard.'}
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {plan.options.map((code, i) => {
          const l = findLanguage(code)
          return (
            <button
              key={code}
              type="button"
              autoFocus={i === 0}
              onClick={() => onChoose(code)}
              className="flex h-[72px] flex-col items-center justify-center rounded-2xl bg-paper text-ink transition-transform duration-150 hover:scale-[1.02] active:scale-[0.98]"
            >
              <span dir="auto" lang={l?.html} className="text-[22px] leading-none font-semibold">
                {l?.native ?? languageLabel(code)}
              </span>
              {l && l.native !== l.name && <span className="mt-1.5 text-[13px] text-ink-3">{l.name}</span>}
            </button>
          )
        })}
      </div>
      {showAll ? (
        <div className="swap-in mt-4 flex flex-wrap justify-center gap-2">
          {rest.map((l) => (
            <button
              key={l.code}
              type="button"
              onClick={() => onChoose(l.code)}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white/[0.07] px-4 text-[14px] ring-1 ring-white/12 transition-colors hover:bg-white/[0.14]"
            >
              <span dir="auto" lang={l.html}>
                {l.native}
              </span>
              {l.native !== l.name && <span className="text-white/45">{l.name}</span>}
            </button>
          ))}
        </div>
      ) : (
        <button type="button" onClick={onShowAll} className="mt-4 text-[14px] font-medium text-white/60 underline decoration-white/20 underline-offset-4 hover:text-paper">
          Another language
        </button>
      )}
    </div>
  )
}

function DraftCard({ ticket, draft, done, model }: { ticket: Ticket; draft: Draft | null; done: boolean; model: string | null }) {
  const category = draft
    ? { id: draft.category, label: DRAFT_CATEGORIES[draft.category] ?? 'Other' }
    : ticket.keywordCategory
  const Icon = category ? (CATEGORY_ICON[category.id] ?? CircleHelp) : null
  const location = draft?.location ?? ticket.address
  // A call can end without a request (a general question, or out of scope).
  const noRequest = done && !draft && !ticket.address
  return (
    <aside aria-label="Mississauga 311 request draft" className="rounded-[24px] bg-paper p-6 text-ink shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9)] lg:sticky lg:top-20">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[12px] font-medium tracking-[0.12em] text-ink-3 uppercase">Mississauga 311 draft</p>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${done && !noRequest ? 'bg-ink text-paper' : 'bg-wash text-ink-3'}`}>
          {noRequest ? 'No request' : done ? 'Ready · not submitted' : 'Drafting'}
        </span>
      </div>
      {noRequest ? (
        <p className="mt-5 text-[15px] leading-snug text-ink-2">No service request was needed on this call. For anything official, call 311 or visit mississauga.ca.</p>
      ) : (
        <dl className="mt-4 divide-y divide-rule">
          <Field label="Category">
            {category && Icon && (
              <span className="inline-flex items-center gap-2 font-medium">
                <Icon className="h-4 w-4" aria-hidden /> {category.label}
              </span>
            )}
          </Field>
          <Field label="Summary">{draft?.summary ?? undefined}</Field>
          <Field label="Location">
            {location && (
              <span className="inline-flex flex-wrap items-start gap-x-2 gap-y-1">
                <MapPin className="mt-1 h-4 w-4 shrink-0" aria-hidden />
                <span dir="auto">{location}</span>
                {draft && !draft.locationConfirmed && (
                  <span className="mt-0.5 rounded-full bg-sample-bg px-2 py-0.5 text-[11px] font-semibold text-sample ring-1 ring-sample-line">checking with caller</span>
                )}
              </span>
            )}
          </Field>
          {draft?.details && <Field label="Details">{draft.details}</Field>}
          {draft && (
            <Field label="Urgency">
              <span className={draft.urgency === 'urgent' ? 'font-semibold text-proof-ink' : undefined}>{URGENCY_LABEL[draft.urgency]}</span>
            </Field>
          )}
          {draft && <Field label="Likely handled by">{RESPONSIBLE_LABELS[draft.responsible] ?? RESPONSIBLE_LABELS.unsure}</Field>}
          <Field label="Language">
            {ticket.lang && (
              <>
                {languageLabel(ticket.lang)}
                <span className="text-ink-3"> · {ticket.langSource === 'confirmed' ? 'confirmed by caller' : 'detected'}</span>
              </>
            )}
          </Field>
          <Field label="Caller’s words">
            {ticket.request && (
              <span dir="auto" lang={htmlLang(ticket.lang)} className="text-[15px]">
                {ticket.request}
              </span>
            )}
          </Field>
        </dl>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-ink-3">
        Independent prototype, not affiliated with the City of Mississauga. Nothing is submitted to 311.
        {model && <> Drafted by {model} on Groq.</>}
      </p>
    </aside>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  const empty = children === undefined || children === false || children === null || children === ''
  return (
    <div className="py-3">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className={`mt-1 text-[16px] leading-snug ${empty ? 'text-rule-2' : 'swap-in'}`}>{empty ? '—' : children}</dd>
    </div>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="border-t border-ink pt-3">
      <dt className="sr-only">{label}</dt>
      <dd className="text-[28px] leading-none font-semibold tracking-[-0.03em]">{value}</dd>
      <dd className="mt-2 text-[13px] leading-snug text-ink-2">{label}</dd>
    </div>
  )
}

function RecorderNote({ state }: { state: string }) {
  if (state === 'denied')
    return <p className="mt-3 max-w-[44ch] text-[14px] text-paper">Microphone access was blocked. Allow it in the browser’s address bar, or upload a recording.</p>
  if (state === 'unsupported')
    return <p className="mt-3 max-w-[44ch] text-[14px] text-paper">This browser can’t record here (it needs HTTPS and a microphone). Upload a recording instead.</p>
  if (state === 'error') return <p className="mt-3 max-w-[44ch] text-[14px] text-paper">The microphone couldn’t start. Check it’s connected, or upload a recording.</p>
  return null
}
