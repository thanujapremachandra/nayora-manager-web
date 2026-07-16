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
    <button onClick={onOpen} className="card card-hover p-4 text-left">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{session.name}</h3>
        <span
          className={`status-pill ${
            session.status === 'completed'
              ? 'border-green-700/25 bg-green-100 text-green-700'
              : 'border-blue-700/25 bg-blue-100 text-blue-700'
          }`}
        >
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${session.status === 'completed' ? 'bg-green-600' : 'bg-blue-700'}`} />
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
