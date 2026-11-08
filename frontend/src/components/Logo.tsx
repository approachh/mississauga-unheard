/** VOXELO wordmark. Four bars of a waveform; the last one, the misheard one, is proof red. */
export function Logo() {
  return (
    <span className="inline-flex items-center gap-2">
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" aria-hidden>
        <rect x="1" y="7.5" width="2.6" height="5" rx="0.8" fill="currentColor" />
        <rect x="5.8" y="3.5" width="2.6" height="13" rx="0.8" fill="currentColor" />
        <rect x="10.6" y="6" width="2.6" height="8" rx="0.8" fill="currentColor" />
        <rect x="15.4" y="1.5" width="2.6" height="17" rx="0.8" fill="var(--color-proof)" />
      </svg>
      <span className="text-[15px] font-bold tracking-[0.14em]">VOXELO</span>
    </span>
  )
}
