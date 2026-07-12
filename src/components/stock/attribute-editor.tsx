'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  renameAttribute,
  deleteAttribute,
  createAttributeValuesBulk,
  renameAttributeValue,
  deleteAttributeValue,
  stockForAttributeValue,
} from '@/lib/db/products'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { parseValuesList } from '@/lib/stock-helpers'
import type { AttributeWithValues } from '@/lib/stock-helpers'

interface Props {
  attribute: AttributeWithValues
  onChanged: () => void
}

export function AttributeEditor({ attribute, onChanged }: Props) {
  const [name, setName] = useState(attribute.name)
  const [valuesText, setValuesText] = useState('')
  const [addingValues, setAddingValues] = useState(false)
  const [confirmDeleteAttr, setConfirmDeleteAttr] = useState(false)
  const [confirmDeleteValue, setConfirmDeleteValue] = useState<{
    id: string
    label: string
    stock: number
  } | null>(null)
  const [busy, setBusy] = useState(false)

  async function handleRenameAttribute() {
    if (name.trim() === attribute.name) return
    const supabase = createClient()
    await renameAttribute(supabase, attribute.id, name.trim() || attribute.name)
    onChanged()
  }

  // Bulk: "S, M, L, XL, XXL" adds all five in one request. Variants for
  // these aren't created yet — that happens once, explicitly, via the
  // "Generate variants" button below the attributes list.
  async function handleAddValues(e: React.FormEvent) {
    e.preventDefault()
    const values = parseValuesList(valuesText)
    if (values.length === 0) return
    setAddingValues(true)
    try {
      const supabase = createClient()
      await createAttributeValuesBulk(supabase, attribute.id, values, attribute.attribute_values.length)
      setValuesText('')
      onChanged()
    } finally {
      setAddingValues(false)
    }
  }

  async function handleDeleteAttribute() {
    setBusy(true)
    try {
      const supabase = createClient()
      await deleteAttribute(supabase, attribute.id)
      onChanged()
    } finally {
      setBusy(false)
      setConfirmDeleteAttr(false)
    }
  }

  async function requestDeleteValue(valueId: string, label: string) {
    const supabase = createClient()
    const stock = await stockForAttributeValue(supabase, valueId)
    setConfirmDeleteValue({ id: valueId, label, stock })
  }

  async function handleDeleteValue() {
    if (!confirmDeleteValue) return
    setBusy(true)
    try {
      const supabase = createClient()
      await deleteAttributeValue(supabase, confirmDeleteValue.id)
      onChanged()
    } finally {
      setBusy(false)
      setConfirmDeleteValue(null)
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          className="input flex-1 py-1.5 text-sm font-medium"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={handleRenameAttribute}
        />
        <button
          type="button"
          onClick={() => setConfirmDeleteAttr(true)}
          aria-label={`Delete ${attribute.name} attribute`}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.166 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {attribute.attribute_values.map((value) => (
          <ValueChip
            key={value.id}
            value={value.value}
            onRename={async (next) => {
              const supabase = createClient()
              await renameAttributeValue(supabase, value.id, next)
              onChanged()
            }}
            onDelete={() => requestDeleteValue(value.id, value.value)}
          />
        ))}
      </div>

      <form onSubmit={handleAddValues} className="mt-2 flex gap-1.5">
        <input
          type="text"
          placeholder={`Add ${attribute.name.toLowerCase()} values, comma-separated (e.g. S, M, L, XL)`}
          className="input py-1.5 text-sm"
          value={valuesText}
          onChange={(e) => setValuesText(e.target.value)}
        />
        <button type="submit" disabled={addingValues} className="btn-secondary px-3 py-1.5 text-sm whitespace-nowrap">
          {addingValues ? 'Adding…' : 'Add values'}
        </button>
      </form>

      <ConfirmDialog
        open={confirmDeleteAttr}
        onClose={() => setConfirmDeleteAttr(false)}
        onConfirm={handleDeleteAttribute}
        confirming={busy}
        title={`Delete "${attribute.name}"?`}
        description={`This removes the "${attribute.name}" attribute and its ${attribute.attribute_values.length} value(s) from all variants. Variants that previously differed only by this attribute may become duplicates — you'll need to review and merge or delete them manually afterward.`}
        confirmLabel="Delete attribute"
      />

      <ConfirmDialog
        open={confirmDeleteValue !== null}
        onClose={() => setConfirmDeleteValue(null)}
        onConfirm={handleDeleteValue}
        confirming={busy}
        title={`Delete "${confirmDeleteValue?.label}"?`}
        description={`Variants using this value currently hold ${confirmDeleteValue?.stock ?? 0} units of stock combined. Deleting it leaves those variants with an incomplete combination — you can remove them manually from the variant list afterward.`}
        confirmLabel="Delete value"
      />
    </div>
  )
}

function ValueChip({
  value,
  onRename,
  onDelete,
}: {
  value: string
  onRename: (next: string) => void
  onDelete: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState(value)

  if (editing) {
    return (
      <input
        autoFocus
        className="input w-24 py-0.5 text-xs"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          setEditing(false)
          if (text.trim() && text.trim() !== value) onRename(text.trim())
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
    )
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
      <button type="button" onClick={() => setEditing(true)}>
        {value}
      </button>
      <button type="button" onClick={onDelete} aria-label={`Delete ${value}`} className="text-gray-400 hover:text-red-600">
        ×
      </button>
    </span>
  )
}
