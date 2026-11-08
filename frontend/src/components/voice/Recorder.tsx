import { FileAudio, Loader2, Mic, Square, Trash2 } from 'lucide-react'
import type { RefObject } from 'react'

/** A captured or uploaded audio clip, held in the browser until the user sends it. */
export interface Clip {
  blob: Blob
  url: string
  name: string
  source: 'recording' | 'upload'
}

const METER_BARS = 56

/**
 * The waveform behind the record button. `useRecorder` drives each `[data-bar]` child's scaleY
 * from the microphone level; when idle the bars breathe slowly instead.
 */
export function MeterBand({ meterRef, isRecording, dimmed }: { meterRef: RefObject<HTMLDivElement | null>; isRecording: boolean; dimmed: boolean }) {
  return (
    <div
      ref={meterRef}
      aria-hidden
      className={`voice-meter pointer-events-none absolute inset-x-0 inset-y-0 mx-auto flex max-w-[900px] items-center gap-[2px] transition-opacity duration-500 sm:gap-[5px] ${dimmed ? 'opacity-25' : 'opacity-100'}`}
    >
      {Array.from({ length: METER_BARS }, (_, i) => {
        const h = 14 + 86 * Math.pow(Math.sin((Math.PI * (i + 0.5)) / METER_BARS), 1.6)
        return (
          <span
            key={i}
            data-bar
            className={`block flex-1 origin-center rounded-full transition-colors duration-500 ${isRecording ? 'bg-[rgb(176_228_255)]' : 'wave-bar bg-[rgb(176_228_255/0.22)]'}`}
            style={{ height: `${h}%`, transform: 'scaleY(0.08)', ['--d' as string]: (((i * 37) % 100) / 100) * 2.6 }}
          />
        )
      })}
    </div>
  )
}

/** The record button: a lit orb with a progress ring while recording. */
export function Orb({
  state,
  isRecording,
  progress,
  disabled,
  onClick,
}: {
  state: string
  isRecording: boolean
  progress: number
  disabled: boolean
  onClick: () => void
}) {
  const R = 74
  const C = 2 * Math.PI * R
  return (
    <div className="relative grid h-40 w-40 place-items-center sm:h-48 sm:w-48">
      {/* Rings radiate from the orb: slowly when idle, faster while recording */}
      <span aria-hidden className="voice-ring absolute inset-6 rounded-full border border-[rgb(176_228_255/0.5)]" style={{ animationDuration: isRecording ? '1.8s' : '4.2s' }} />
      {isRecording && <span aria-hidden className="voice-ring absolute inset-6 rounded-full border border-[rgb(176_228_255/0.5)]" style={{ animationDuration: '1.8s', animationDelay: '0.9s' }} />}
      <svg aria-hidden viewBox="0 0 160 160" className="absolute inset-0 h-full w-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="rgb(255 255 255 / 0.08)" strokeWidth="2" />
        {isRecording && (
          <circle cx="80" cy="80" r={R} fill="none" stroke="rgb(176 228 255)" strokeWidth="3" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} style={{ transition: 'stroke-dashoffset 250ms linear' }} />
        )}
      </svg>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
        className="relative grid h-28 w-28 place-items-center rounded-full bg-paper text-ink shadow-[0_0_0_1px_rgb(255_255_255/0.6),0_0_60px_rgb(176_228_255/0.35),0_20px_50px_-10px_rgb(0_0_0/0.8)] transition-[transform,box-shadow] duration-300 ease-out hover:scale-105 hover:shadow-[0_0_0_1px_rgb(255_255_255/0.8),0_0_80px_rgb(176_228_255/0.55),0_20px_50px_-10px_rgb(0_0_0/0.8)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none disabled:hover:scale-100 sm:h-32 sm:w-32"
      >
        {state === 'requesting' ? <Loader2 className="h-8 w-8 animate-spin" aria-hidden /> : isRecording ? <Square className="h-7 w-7 fill-current" aria-hidden /> : <Mic className="h-9 w-9" aria-hidden />}
      </button>
    </div>
  )
}

/** The captured clip: playback, the one primary action, and a way back. Labels are set by the page. */
export function ClipCard({
  clip,
  busy,
  canSubmit,
  actionLabel,
  busyLabel,
  onClear,
  onCancel,
}: {
  clip: Clip
  busy: boolean
  canSubmit: boolean
  actionLabel: string
  busyLabel: string
  onClear: () => void
  onCancel: () => void
}) {
  return (
    <div className="swap-in w-full max-w-[460px] rounded-[28px] bg-[rgb(14_19_26/0.78)] p-5 shadow-[0_30px_80px_-30px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.06)] ring-1 ring-white/10 backdrop-blur-xl sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2.5 text-[14px] font-medium text-white/85">
          {clip.source === 'recording' ? <Mic className="h-4 w-4 shrink-0 text-[rgb(176_228_255)]" aria-hidden /> : <FileAudio className="h-4 w-4 shrink-0 text-[rgb(176_228_255)]" aria-hidden />}
          <span className="truncate">{clip.name}</span>
        </span>
        <button
          type="button"
          onClick={onClear}
          disabled={busy}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-[13px] text-white/55 transition-colors hover:bg-white/[0.08] hover:text-paper disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden /> Start over
        </button>
      </div>
      <audio controls src={clip.url} className="mt-4 block h-10 w-full [color-scheme:dark]" aria-label="Play back your audio" />
      <div className="mt-5 flex gap-2">
        {busy ? (
          <>
            <span className="inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-white/15 text-[16px] font-medium text-paper">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> {busyLabel}
            </span>
            <button type="button" onClick={onCancel} className="h-14 rounded-full px-6 text-[15px] font-medium text-white/70 ring-1 ring-white/20 transition-colors hover:text-paper hover:ring-white/50">
              Cancel
            </button>
          </>
        ) : (
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-14 flex-1 items-center justify-center rounded-full bg-paper text-[16px] font-medium text-ink shadow-[0_0_40px_rgb(176_228_255/0.3)] transition-[transform,box-shadow] duration-150 hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-white/15 disabled:text-white/40 disabled:shadow-none disabled:hover:scale-100"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}
