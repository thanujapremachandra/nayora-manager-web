'use client'

interface Props {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onCancel: () => void
  error?: string | null
  saved?: boolean
}

// Floating action bar that slides in whenever a settings form has unsaved
// changes — save or discard without scrolling to the bottom of the page.
// Sits above the mobile tab bar (bottom-20) and centered on desktop.
export function SaveBar({ dirty, saving, onSave, onCancel, error, saved }: Props) {
  if (!dirty && !saved && !error) return null

  return (
    <div className="fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 md:bottom-6">
      <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-gray-200 bg-surface px-4 py-3 shadow-xl">
        <p className="flex-1 text-sm">
          {error ? (
            <span role="alert" className="text-red-700">{error}</span>
          ) : saved && !dirty ? (
            <span role="status" className="font-medium text-green-700">Saved ✓</span>
          ) : (
            <span className="font-medium text-gray-900">Unsaved changes</span>
          )}
        </p>
        {dirty && (
          <>
            <button type="button" onClick={onCancel} disabled={saving} className="btn-secondary px-3 py-2 text-xs">
              Cancel
            </button>
            <button type="button" onClick={onSave} disabled={saving} className="btn-primary px-4 py-2 text-xs">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
