import { useCountUp } from '../../hooks/useCountUp'

/** A percentage as a big number with a quieter decimal ("24" ".0%"). Counts to each new value. `value` is already ×100. */
export function BigRate({ value }: { value: number }) {
  const v = useCountUp(value)
  const [whole, tenth] = v.toFixed(1).split('.')
  return (
    <>
      <span aria-hidden className="text-[clamp(4.5rem,11vw,7.5rem)]">
        {whole}
        <span className="text-[0.4em] tracking-normal text-white/40">.{tenth}%</span>
      </span>
      <span className="sr-only">{value.toFixed(1)} percent</span>
    </>
  )
}
