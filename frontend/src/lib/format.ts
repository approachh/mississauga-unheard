export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`

export const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())

export const int = (n: number) => n.toLocaleString('en-CA')

/** Seconds as m:ss. */
export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
