interface Props {
  label: string
  value: string
  hint?: string
  tone?: 'default' | 'warning' | 'danger' | 'success'
}

const TONE_STYLES: Record<NonNullable<Props['tone']>, string> = {
  default: 'text-gray-900',
  warning: 'text-amber-600',
  danger: 'text-red-600',
  success: 'text-green-600',
}

export function KpiCard({ label, value, hint, tone = 'default' }: Props) {
  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-1.5 font-display text-2xl font-bold tracking-tight sm:text-3xl ${TONE_STYLES[tone]}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
