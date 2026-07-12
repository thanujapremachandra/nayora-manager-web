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
    <div className="card p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${TONE_STYLES[tone]}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-gray-400">{hint}</p>}
    </div>
  )
}
