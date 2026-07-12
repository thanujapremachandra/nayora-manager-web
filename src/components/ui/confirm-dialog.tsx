'use client'

import { Dialog } from './dialog'

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  danger?: boolean
  confirming?: boolean
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  danger = true,
  confirming = false,
}: ConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className={danger ? 'btn-danger' : 'btn-primary'}
          >
            {confirming ? 'Working…' : confirmLabel}
          </button>
        </div>
      }
    >
      <p className="text-sm text-gray-600">{description}</p>
    </Dialog>
  )
}
