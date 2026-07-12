'use client'

import type { Session } from '@/lib/supabase/types'
import type { SessionCounts } from '@/lib/db/sessions'

interface Props {
  session: Session
  counts: SessionCounts
  onOpen: () => void
}

export function SessionCard({ session, counts, onOpen }: Props) {
  return (
    <button onClick={onOpen} className="card p-4 text-left hover:bg-gray-50">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{session.name}</h3>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
            session.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
          }`}
        >
          {session.status === 'completed' ? 'Completed' : 'Pending'}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">
        {counts.total} order(s)
        {counts.frozen > 0 && <span className="text-cyan-600"> · {counts.frozen} frozen</span>}
      </p>
      <p className="mt-1 text-xs text-gray-400">{new Date(session.created_at).toLocaleDateString()}</p>
    </button>
  )
}
