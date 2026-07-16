import type { SessionTrendPoint } from '@/lib/db/analytics'
import { formatRs } from '@/lib/stock-helpers'

interface Props {
  points: SessionTrendPoint[]
}

const CHART_HEIGHT = 80
const BAR_GAP = 6

// Bars use the theme's lavender via CSS variables (they follow light/dark
// automatically); the peak bar is highlighted in the warm accent yellow,
// matching the reference dashboard's chart treatment.
export function TrendChart({ points }: Props) {
  if (points.length === 0) {
    return (
      <div className="flex h-24 items-center justify-center rounded-xl bg-gray-100/60">
        <p className="text-sm text-gray-400">No completed sessions yet.</p>
      </div>
    )
  }

  const max = Math.max(...points.map((p) => p.codTotal), 1)

  return (
    <div>
      <svg
        viewBox={`0 0 ${points.length * (100 / points.length)} ${CHART_HEIGHT}`}
        className="h-24 w-full"
        preserveAspectRatio="none"
        role="img"
        aria-label="COD revenue by session"
      >
        {points.map((p, i) => {
          const barWidth = 100 / points.length - BAR_GAP / 10
          const barHeight = (p.codTotal / max) * (CHART_HEIGHT - 4)
          const x = i * (100 / points.length) + BAR_GAP / 20
          const isPeak = p.codTotal === max && p.codTotal > 0
          return (
            <rect
              key={p.sessionId}
              x={x}
              y={CHART_HEIGHT - barHeight}
              width={Math.max(barWidth, 1)}
              height={Math.max(barHeight, 1)}
              rx={2}
              style={{ fill: isPeak ? 'rgb(var(--accent-400))' : 'rgb(var(--brand-400))' }}
            >
              {/* Cosmetic tooltip only — SVG <title> as a deeply-nested
                  dynamic text node is a known source of spurious hydration
                  mismatches in React. suppressHydrationWarning only
                  reliably suppresses a *single* text child, so this is one
                  template-literal expression rather than several
                  interpolated children. */}
              <title suppressHydrationWarning>{`${p.name}: ${formatRs(p.codTotal)} (${p.sentCount} sent)`}</title>
            </rect>
          )
        })}
      </svg>
      <div className="mt-1.5 flex justify-between text-xs text-gray-400">
        <span>{points[0].name}</span>
        <span>{points[points.length - 1].name}</span>
      </div>
    </div>
  )
}
