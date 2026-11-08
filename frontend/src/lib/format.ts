export const pct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`

export const titleCase = (s: string) => s.replace(/\b\p{L}/gu, (c) => c.toUpperCase())

export const int = (n: number) => n.toLocaleString('en-CA')
