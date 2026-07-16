'use client'

import type { DateRange } from '@/lib/db/analytics'

interface Props {
  range: DateRange
  onChange: (range: DateRange) => void
}

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toIsoDate(d)
}

function startOfThisMonth(): string {
  const d = new Date()
  d.setDate(1)
  return toIsoDate(d)
}

const PRESETS: { label: string; range: () => DateRange }[] = [
  { label: '7 days', range: () => ({ from: daysAgo(6), to: toIsoDate(new Date()) }) },
  { label: '30 days', range: () => ({ from: daysAgo(29), to: toIsoDate(new Date()) }) },
  { label: '90 days', range: () => ({ from: daysAgo(89), to: toIsoDate(new Date()) }) },
  { label: 'This month', range: () => ({ from: startOfThisMonth(), to: toIsoDate(new Date()) }) },
]

export function DateRangePicker({ range, onChange }: Props) {
  const activePreset = PRESETS.find((p) => {
    const r = p.range()
    return r.from === range.from && r.to === range.to
  })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="seg">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onChange(p.range())}
            className={`seg-item ${activePreset?.label === p.label ? 'seg-item-active' : ''}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-1.5 text-xs">
        <input
          type="date"
          value={range.from}
          max={range.to}
          onChange={(e) => onChange({ ...range, from: e.target.value })}
          className="input w-auto py-1 text-xs"
          aria-label="From date"
        />
        <span className="text-gray-400">to</span>
        <input
          type="date"
          value={range.to}
          min={range.from}
          max={toIsoDate(new Date())}
          onChange={(e) => onChange({ ...range, to: e.target.value })}
          className="input w-auto py-1 text-xs"
          aria-label="To date"
        />
      </div>
    </div>
  )
}
