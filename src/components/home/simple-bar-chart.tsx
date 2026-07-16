interface Point {
  label: string
  value: number
  tooltip?: string
}

interface Props {
  points: Point[]
  emptyMessage?: string
}

const CHART_HEIGHT = 80
const BAR_GAP = 6

// A generic version of TrendChart's bars — used by the Reports section
// where the underlying data shape (date buckets, statuses, etc.) varies by
// report type, but the visual is always "one bar per labeled point."
// Lavender bars from the theme variables; the peak bar gets the warm accent.
export function SimpleBarChart({ points, emptyMessage = 'No data for this range.' }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl bg-gray-100/60">
        <p className="text-sm text-gray-400">{emptyMessage}</p>
      </div>
    )
  }

  const max = Math.max(...points.map((p) => p.value), 1)

  return (
    <div>
      <svg
        viewBox={`0 0 ${points.length * (100 / points.length)} ${CHART_HEIGHT}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="Chart"
      >
        {points.map((p, i) => {
          const barWidth = 100 / points.length - BAR_GAP / 10
          const barHeight = (p.value / max) * (CHART_HEIGHT - 4)
          const x = i * (100 / points.length) + BAR_GAP / 20
          const isPeak = p.value === max && p.value > 0
          return (
            <rect
              key={`${p.label}-${i}`}
              x={x}
              y={CHART_HEIGHT - barHeight}
              width={Math.max(barWidth, 1)}
              height={Math.max(barHeight, 1)}
              rx={2}
              style={{ fill: isPeak ? 'rgb(var(--accent-400))' : 'rgb(var(--brand-400))' }}
            >
              <title suppressHydrationWarning>{p.tooltip ?? `${p.label}: ${p.value}`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-xs text-gray-400">
        <span>{points[0].label}</span>
        <span>{points[points.length - 1].label}</span>
      </div>
    </div>
  )
}
