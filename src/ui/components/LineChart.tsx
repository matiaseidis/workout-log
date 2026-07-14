export interface Point {
  label: string
  value: number
}

const W = 320
const H = 176
const PAD_L = 36
const PAD_R = 14
const PAD_T = 12
const PAD_B = 26

export function LineChart({ pts }: { pts: Point[] }) {
  if (pts.length < 2) return <p class="note" style="padding:12px">Not enough sessions yet — complete at least two.</p>

  const values = pts.map((p) => p.value)
  const lo = Math.floor(Math.min(...values) / 5) * 5 - 2.5
  const hi = Math.ceil(Math.max(...values) / 5) * 5 + 2.5
  const x = (i: number) => PAD_L + (i / (pts.length - 1)) * (W - PAD_L - PAD_R)
  const y = (v: number) => PAD_T + (1 - (v - lo) / (hi - lo)) * (H - PAD_T - PAD_B)

  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${path} L${x(pts.length - 1).toFixed(1)},${H - PAD_B} L${PAD_L},${H - PAD_B} Z`
  const gridVals = [lo + 2.5, (lo + hi) / 2, hi - 2.5]
  const labelStep = Math.ceil(pts.length / 5)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight over time">
      {gridVals.map((v) => (
        <>
          <line x1={PAD_L} x2={W - PAD_R} y1={y(v)} y2={y(v)} stroke="var(--line)" stroke-width="1" />
          <text x={PAD_L - 6} y={y(v) + 3} text-anchor="end" font-size="9" fill="var(--ink2)">
            {v}
          </text>
        </>
      ))}
      <path d={area} fill="var(--accent)" opacity="0.08" />
      <path d={path} fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" />
      {pts.map((p, i) => (
        <circle
          cx={x(i)}
          cy={y(p.value)}
          r={i === pts.length - 1 ? 4 : 3}
          fill={i === pts.length - 1 ? 'var(--accent)' : 'var(--surface)'}
          stroke="var(--accent)"
          stroke-width="2"
        />
      ))}
      {pts.map(
        (p, i) =>
          (i % labelStep === 0 || i === pts.length - 1) && (
            <text x={x(i)} y={H - 8} text-anchor="middle" font-size="9" fill="var(--ink2)">
              {p.label}
            </text>
          ),
      )}
    </svg>
  )
}
