import Link from 'next/link'
import type { AttentionCounts } from '@/lib/db/analytics'

interface Props {
  attention: AttentionCounts
}

export function AttentionCard({ attention }: Props) {
  const nothingToFlag = attention.frozenCount === 0 && attention.issueCount === 0

  return (
    <div className="card p-4">
      <h3 className="text-sm font-semibold text-gray-900">Needs attention</h3>
      {nothingToFlag ? (
        <p className="mt-2 text-sm text-gray-500">Nothing frozen or flagged right now.</p>
      ) : (
        <div className="mt-3 space-y-1.5">
          <Link
            href="/orders?status=frozen"
            className="flex items-center justify-between rounded-xl bg-gray-100 px-3.5 py-2.5 text-sm transition-colors hover:bg-gray-200"
          >
            <span className="flex items-center gap-2 text-gray-700">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-cyan-600" />
              Frozen orders
            </span>
            <span className="font-display font-semibold text-gray-900">{attention.frozenCount}</span>
          </Link>
          <Link
            href="/orders?status=issue"
            className="flex items-center justify-between rounded-xl bg-gray-100 px-3.5 py-2.5 text-sm transition-colors hover:bg-gray-200"
          >
            <span className="flex items-center gap-2 text-gray-700">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-red-600" />
              Issue orders
            </span>
            <span className="font-display font-semibold text-gray-900">{attention.issueCount}</span>
          </Link>
        </div>
      )}
    </div>
  )
}
