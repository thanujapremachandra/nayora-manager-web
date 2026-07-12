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
        <div className="mt-2 space-y-1.5 text-sm">
          <Link href="/orders?status=frozen" className="flex justify-between text-cyan-700 hover:underline">
            <span>Frozen orders</span>
            <span className="font-medium">{attention.frozenCount}</span>
          </Link>
          <Link href="/orders?status=issue" className="flex justify-between text-red-700 hover:underline">
            <span>Issue orders</span>
            <span className="font-medium">{attention.issueCount}</span>
          </Link>
        </div>
      )}
    </div>
  )
}
