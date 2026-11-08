import { ChevronDown, Globe } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { VOICE_LANGUAGES } from '../../lib/voice'

const shortName = (name: string) => name.replace(/ \(.*\)$/, '')

/**
 * One compact button showing the chosen language; the full list opens in a small panel.
 * Keeps the stage free of 25 labels. Arrow keys move through the grid, Escape closes.
 */
export function LanguagePicker({ value, onChange, disabled }: { value: string; onChange: (code: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const current = VOICE_LANGUAGES.find((l) => l.code === value)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus()
    return () => document.removeEventListener('pointerdown', onDown)
  }, [open])

  const close = () => {
    setOpen(false)
    triggerRef.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') return close()
    const list = listRef.current
    if (!list) return
    const items = Array.from(list.querySelectorAll<HTMLElement>('[role="option"]'))
    const at = items.indexOf(document.activeElement as HTMLElement)
    const cols = getComputedStyle(list).gridTemplateColumns.split(' ').length
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
    if (step === undefined || at < 0) return
    e.preventDefault()
    items[Math.min(items.length - 1, Math.max(0, at + step))]?.focus()
  }

  return (
    <div ref={rootRef} className="relative mx-auto flex w-fit justify-center">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-11 items-center gap-2.5 rounded-full bg-white/[0.07] pr-4 pl-4 text-[15px] font-medium ring-1 ring-white/12 transition-colors hover:bg-white/[0.12] disabled:opacity-50"
      >
        <Globe className="h-4 w-4 text-[rgb(176_228_255)]" aria-hidden />
        <span className="sr-only">Language: </span>
        {value === 'auto' ? 'Auto-detect' : shortName(current?.name ?? value)}
        <ChevronDown className={`h-4 w-4 text-white/50 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {open && (
        <div
          className="swap-in absolute top-full left-1/2 z-20 mt-3 w-[min(92vw,400px)] -translate-x-1/2 rounded-2xl bg-[rgb(14_19_26/0.96)] p-2 shadow-[0_30px_80px_-20px_rgb(0_0_0/0.9)] ring-1 ring-white/12 backdrop-blur-xl"
          onKeyDown={onKeyDown}
        >
          <div ref={listRef} role="listbox" aria-label="Language you will speak" className="grid max-h-[min(56vh,340px)] grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3">
            {VOICE_LANGUAGES.map((l) => {
              const on = l.code === value
              return (
                <button
                  key={l.code}
                  type="button"
                  role="option"
                  aria-selected={on}
                  onClick={() => {
                    onChange(l.code)
                    close()
                  }}
                  className={`h-10 rounded-xl px-3 text-left text-[14px] transition-colors ${on ? 'bg-paper font-medium text-ink' : 'text-white/75 hover:bg-white/[0.08] hover:text-paper'}`}
                >
                  {l.code === 'auto' ? 'Auto-detect' : shortName(l.name)}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
