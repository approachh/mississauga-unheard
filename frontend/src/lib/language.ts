/** Join key across datasets that name languages differently ("Mandarin Chinese", "mandarin"). */
const ALIASES: Record<string, string> = { 'mandarin chinese': 'mandarin' }

export const langKey = (name: string) => {
  const k = name.trim().toLowerCase()
  return ALIASES[k] ?? k
}
