import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { MAX_RECORDING_SECONDS } from '../lib/voice'

export type RecorderState = 'idle' | 'requesting' | 'recording' | 'denied' | 'unsupported' | 'error'

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']

const supported = () =>
  typeof window !== 'undefined' &&
  window.isSecureContext &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined'

/**
 * Microphone recording via MediaRecorder. Audio stays in the browser as a Blob until the
 * user chooses to transcribe it. `meterRef` children get live level heights while recording.
 */
export function useRecorder(onComplete: (blob: Blob) => void, meterRef: RefObject<HTMLDivElement | null>) {
  const [state, setState] = useState<RecorderState>(() => (supported() ? 'idle' : 'unsupported'))
  const [elapsed, setElapsed] = useState(0)

  const recorder = useRef<MediaRecorder | null>(null)
  const stream = useRef<MediaStream | null>(null)
  const audioCtx = useRef<AudioContext | null>(null)
  const raf = useRef(0)
  const ticker = useRef(0)
  const onCompleteRef = useRef(onComplete)
  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  const teardown = useCallback(() => {
    cancelAnimationFrame(raf.current)
    window.clearInterval(ticker.current)
    stream.current?.getTracks().forEach((t) => t.stop())
    stream.current = null
    void audioCtx.current?.close().catch(() => {})
    audioCtx.current = null
    meterRef.current?.querySelectorAll<HTMLElement>('[data-bar]').forEach((b) => (b.style.transform = 'scaleY(0.08)'))
  }, [meterRef])

  const stop = useCallback(() => {
    if (recorder.current?.state === 'recording') recorder.current.stop()
  }, [])

  const start = useCallback(async () => {
    if (!supported()) return setState('unsupported')
    setState('requesting')
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
      stream.current = s
      const mimeType = MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m))
      const rec = new MediaRecorder(s, mimeType ? { mimeType } : undefined)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        teardown()
        setState('idle')
        const blob = new Blob(chunks, { type: (rec.mimeType || mimeType || 'audio/webm').split(';')[0] })
        onCompleteRef.current(blob)
      }
      recorder.current = rec

      // Level meter
      const ctx = new AudioContext()
      audioCtx.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      ctx.createMediaStreamSource(s).connect(analyser)
      const buf = new Uint8Array(analyser.frequencyBinCount)
      const draw = () => {
        analyser.getByteFrequencyData(buf)
        const bars = meterRef.current?.querySelectorAll<HTMLElement>('[data-bar]')
        if (bars?.length) {
          const per = Math.floor(buf.length / 2 / bars.length) || 1 // voice energy sits in the lower half
          bars.forEach((bar, i) => {
            let sum = 0
            for (let k = 0; k < per; k++) sum += buf[i * per + k]
            bar.style.transform = `scaleY(${Math.max(0.08, Math.min(1, sum / per / 160))})`
          })
        }
        raf.current = requestAnimationFrame(draw)
      }
      draw()

      const startedAt = Date.now()
      setElapsed(0)
      ticker.current = window.setInterval(() => {
        const secs = (Date.now() - startedAt) / 1000
        setElapsed(secs)
        if (secs >= MAX_RECORDING_SECONDS) stop()
      }, 200)

      rec.start(250)
      setState('recording')
    } catch (e) {
      teardown()
      const name = e instanceof DOMException ? e.name : ''
      setState(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
    }
  }, [meterRef, stop, teardown])

  useEffect(() => () => {
    if (recorder.current?.state === 'recording') {
      recorder.current.onstop = null
      recorder.current.stop()
    }
    teardown()
  }, [teardown])

  return { state, elapsed, start, stop }
}
