/** 'YYYY-MM-DD' -> short local label like 'Jul 10'. */
export function fmtDate(isoDay: string): string {
  const [y, m, d] = isoDay.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

export function fmtDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return ''
  const min = Math.max(1, Math.round((Date.parse(completedAt) - Date.parse(startedAt)) / 60000))
  return `${min} min`
}

export function setCount(exercises: { sets: unknown[] }[]): number {
  return exercises.reduce((n, e) => n + e.sets.length, 0)
}
