'use client'

import { Dialog } from '@/components/ui/dialog'

interface Props {
  open: boolean
  onClose: () => void
  onChoose: (mode: 'reserved' | 'released') => void
}

export function FreezeDialog({ open, onClose, onChoose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} title="Freeze order" size="sm">
      <p className="text-sm text-gray-600">
        This order goes on hold but stays in the session. What should happen to its reserved stock?
      </p>
      <div className="mt-4 space-y-2">
        <button
          onClick={() => onChoose('reserved')}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-left text-sm hover:border-brand-400 hover:bg-brand-50"
        >
          <span className="font-medium text-gray-900">Keep reserved</span>
          <p className="text-gray-500">Stock stays held for this order until it&apos;s resumed.</p>
        </button>
        <button
          onClick={() => onChoose('released')}
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-left text-sm hover:border-brand-400 hover:bg-brand-50"
        >
          <span className="font-medium text-gray-900">Release back to pool</span>
          <p className="text-gray-500">Other orders can use this stock while this one is on hold.</p>
        </button>
      </div>
    </Dialog>
  )
}
