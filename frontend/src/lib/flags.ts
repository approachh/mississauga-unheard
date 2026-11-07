export type FlagKind = 'S' | 'C' | 'E'

export const FLAG_TEXT: Record<FlagKind, string> = {
  S: 'Sample placeholder, not a research finding',
  C: 'Computed in the browser from the word alignment',
  E: 'Use with caution',
}
