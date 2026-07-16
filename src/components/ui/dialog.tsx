'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'slideover'
  footer?: React.ReactNode
}

// w-[calc(100%-2rem)] (instead of w-full) keeps a little breathing room on
// phones, where the dialog would otherwise sit flush against both edges.
const SIZE_CLASSES: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'w-[calc(100%-2rem)] max-w-sm rounded-2xl',
  md: 'w-[calc(100%-2rem)] max-w-lg rounded-2xl',
  lg: 'w-[calc(100%-2rem)] max-w-2xl rounded-2xl',
  // Full-screen on mobile; a wide right-anchored panel on desktop —
  // these host the big product/order editors, which need real room.
  slideover: 'fixed inset-y-0 right-0 ml-auto h-full w-full rounded-none sm:max-w-3xl lg:max-w-5xl',
}

export function Dialog({ open, onClose, title, children, size = 'md', footer }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  // Dialogs that open other dialogs (e.g. a delete-confirm inside the
  // product editor) would otherwise nest one <dialog> inside another in the
  // DOM, which is a known source of native <dialog> bugs — closing the
  // inner one can cause the browser to dismiss the outer one too. Portaling
  // every Dialog straight to <body> keeps them siblings, not ancestors.
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
    // `mounted` is included because the portal's <dialog> ref only exists
    // once mounted=true. A Dialog that renders directly with open=true on
    // its very first appearance (e.g. one only rendered once an item is
    // selected, like the stock-adjustment dialog) would otherwise run this
    // effect once with no ref yet, then never again — since `open` itself
    // never changes — leaving showModal() permanently uncalled.
  }, [open, mounted])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return

    function handleCancel(e: Event) {
      e.preventDefault()
      onClose()
    }
    function handleClick(e: MouseEvent) {
      if (e.target === dialog) onClose()
    }

    dialog.addEventListener('cancel', handleCancel)
    dialog.addEventListener('click', handleClick)
    return () => {
      dialog.removeEventListener('cancel', handleCancel)
      dialog.removeEventListener('click', handleClick)
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      className={`${SIZE_CLASSES[size]} m-auto max-h-[90vh] flex-col overflow-hidden border border-gray-200 bg-surface p-0 text-gray-900 shadow-xl backdrop:bg-black/60 backdrop:backdrop-blur-sm open:flex`}
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <h2 id={titleId} className="text-lg font-semibold text-gray-900">
          {title}
        </h2>
        <button
          onClick={onClose}
          aria-label="Close"
          className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5">{children}</div>

      {footer && <div className="border-t border-gray-200 px-5 py-4">{footer}</div>}
    </dialog>,
    document.body
  )
}
