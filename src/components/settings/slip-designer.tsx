'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/db/settings'
import {
  SLIP_BOX_WIDTH_MM,
  SLIP_BOX_HEIGHT_MM,
  SLIP_FIELD_LABELS,
  TRANSFORM_LABELS,
  createSlipNode,
  resolveSlipNodeText,
  sampleSlipContext,
} from '@/lib/slip-template'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { Settings, SlipFieldKey, SlipNode, SlipTransform } from '@/lib/supabase/types'

interface Props {
  settings: Settings
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Visually enlarges the canvas so it's comfortable to eyeball-center
// without scrolling — both the box and a CSS scale transform use mm units,
// so text/spacing zoom together (true WYSIWYG) and getBoundingClientRect()
// in the drag handlers already reports the post-zoom size, no extra math.
const CANVAS_ZOOM = 1.4

export function SlipDesigner({ settings: initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const [nodes, setNodes] = useState<SlipNode[]>(initialSettings.slip_template?.nodes ?? [])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const selected = nodes.find((n) => n.id === selectedId) ?? null
  const ctx = sampleSlipContext(settings)

  function updateNode(id: string, patch: Partial<SlipNode>) {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)))
  }

  function removeNode(id: string) {
    setNodes((prev) => prev.filter((n) => n.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  // Dropping a palette item: track the pointer with capture on the palette
  // button itself (works for touch too), then on release work out where the
  // pointer physically is relative to the canvas and create the node there.
  function handlePaletteDown(fieldKey: SlipFieldKey, e: React.PointerEvent<HTMLButtonElement>) {
    const button = e.currentTarget
    button.setPointerCapture(e.pointerId)

    function handleUp(ev: PointerEvent) {
      button.releasePointerCapture(e.pointerId)
      button.removeEventListener('pointerup', handleUp)

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return
      const xPx = ev.clientX - rect.left
      const yPx = ev.clientY - rect.top
      if (xPx < 0 || yPx < 0 || xPx > rect.width || yPx > rect.height) return // dropped outside the canvas

      const pxPerMm = rect.width / SLIP_BOX_WIDTH_MM
      const x = clamp(xPx / pxPerMm, 0, SLIP_BOX_WIDTH_MM - 10)
      const y = clamp(yPx / pxPerMm, 0, SLIP_BOX_HEIGHT_MM - 6)
      const node = createSlipNode(fieldKey, x, y)
      setNodes((prev) => [...prev, node])
      setSelectedId(node.id)
    }

    button.addEventListener('pointerup', handleUp)
  }

  // Repositioning a node already on the canvas.
  function handleNodeDown(node: SlipNode, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    setSelectedId(node.id)
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pxPerMm = rect.width / SLIP_BOX_WIDTH_MM
    const startX = e.clientX
    const startY = e.clientY
    const originX = node.x
    const originY = node.y

    function handleMove(ev: PointerEvent) {
      const deltaXMm = (ev.clientX - startX) / pxPerMm
      const deltaYMm = (ev.clientY - startY) / pxPerMm
      updateNode(node.id, {
        x: clamp(originX + deltaXMm, 0, SLIP_BOX_WIDTH_MM - 10),
        y: clamp(originY + deltaYMm, 0, SLIP_BOX_HEIGHT_MM - 6),
      })
    }
    function handleUp() {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
    }
    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }

  async function handleSave() {
    setSaving(true)
    try {
      const updated = await updateSettings(createClient(), settings.id, { slip_template: { nodes } })
      setSettings(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    setSaving(true)
    try {
      const updated = await updateSettings(createClient(), settings.id, { slip_template: null })
      setSettings(updated)
      setNodes([])
      setSelectedId(null)
    } finally {
      setSaving(false)
      setConfirmReset(false)
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Drag a field from the palette onto the slip below to place it. Drag a placed field to move
        it; use the panel on the right for exact position, size, and text formatting. This previews
        with sample data — it&apos;s not connected to any real order.
      </p>

      {/* Palette */}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(SLIP_FIELD_LABELS) as SlipFieldKey[]).map((key) => (
          <button
            key={key}
            onPointerDown={(e) => handlePaletteDown(key, e)}
            className="cursor-grab touch-none rounded-full border border-gray-300 bg-surface px-3 py-1.5 text-xs font-medium text-gray-700 shadow-sm active:cursor-grabbing"
          >
            + {SLIP_FIELD_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        {/* Canvas */}
        <div className="shrink-0 overflow-auto rounded-lg bg-gray-100 p-4">
          <div
            style={{ width: `${SLIP_BOX_WIDTH_MM * CANVAS_ZOOM}mm`, height: `${SLIP_BOX_HEIGHT_MM * CANVAS_ZOOM}mm` }}
          >
            <div
              ref={canvasRef}
              className="relative origin-top-left bg-white text-black shadow"
              style={{
                width: `${SLIP_BOX_WIDTH_MM}mm`,
                height: `${SLIP_BOX_HEIGHT_MM}mm`,
                border: '1.5px solid #000',
                transform: `scale(${CANVAS_ZOOM})`,
              }}
              onPointerDown={() => setSelectedId(null)}
            >
            {nodes.map((node) =>
              node.fieldKey === 'box' ? (
                <div
                  key={node.id}
                  onPointerDown={(e) => handleNodeDown(node, e)}
                  className={`absolute cursor-move touch-none border-black ${
                    selectedId === node.id ? 'border-2 border-brand-500' : 'border'
                  }`}
                  style={{
                    left: `${node.x}mm`,
                    top: `${node.y}mm`,
                    width: `${node.width}mm`,
                    height: `${node.height ?? 20}mm`,
                  }}
                />
              ) : (
                <div
                  key={node.id}
                  onPointerDown={(e) => handleNodeDown(node, e)}
                  className={`absolute cursor-move touch-none whitespace-pre-line leading-snug ${
                    selectedId === node.id ? 'outline outline-2 outline-brand-500' : 'hover:outline hover:outline-1 hover:outline-gray-300'
                  }`}
                  style={{
                    left: `${node.x}mm`,
                    top: `${node.y}mm`,
                    width: `${node.width}mm`,
                    fontSize: `${node.fontSize}pt`,
                    fontWeight: node.bold ? 700 : 400,
                    textAlign: node.align,
                  }}
                >
                  {resolveSlipNodeText(node, ctx)}
                </div>
              )
            )}
            {nodes.length === 0 && (
              <p className="absolute inset-0 flex items-center justify-center p-4 text-center text-xs text-gray-400">
                Drag a field here from the palette above
              </p>
            )}
            </div>
          </div>
        </div>

        {/* Properties panel */}
        <div className="w-full shrink-0 lg:w-56">
          {selected ? (
            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">{SLIP_FIELD_LABELS[selected.fieldKey]}</p>
                <button onClick={() => removeNode(selected.id)} className="text-xs font-medium text-red-600 hover:text-red-700">
                  Remove
                </button>
              </div>

              {selected.fieldKey === 'custom_text' && (
                <div>
                  <label className="label mb-1">Text</label>
                  <input
                    type="text"
                    className="input text-sm"
                    value={selected.customText ?? ''}
                    onChange={(e) => updateNode(selected.id, { customText: e.target.value })}
                  />
                </div>
              )}

              {selected.fieldKey === 'remark' && (
                <p className="text-xs text-gray-500">
                  Shows the order&apos;s remark if one was added — stays blank otherwise.
                </p>
              )}

              {/* Box is a plain rectangle — position/size only, no text options. */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label mb-1">X (mm)</label>
                  <input
                    type="number"
                    min={0}
                    max={SLIP_BOX_WIDTH_MM}
                    className="input text-sm"
                    value={Math.round(selected.x)}
                    onChange={(e) => updateNode(selected.id, { x: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label mb-1">Y (mm)</label>
                  <input
                    type="number"
                    min={0}
                    max={SLIP_BOX_HEIGHT_MM}
                    className="input text-sm"
                    value={Math.round(selected.y)}
                    onChange={(e) => updateNode(selected.id, { y: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label mb-1">Width (mm)</label>
                  <input
                    type="number"
                    min={5}
                    max={SLIP_BOX_WIDTH_MM}
                    className="input text-sm"
                    value={selected.width}
                    onChange={(e) => updateNode(selected.id, { width: Number(e.target.value) })}
                  />
                </div>
                {selected.fieldKey === 'box' ? (
                  <div>
                    <label className="label mb-1">Height (mm)</label>
                    <input
                      type="number"
                      min={5}
                      max={SLIP_BOX_HEIGHT_MM}
                      className="input text-sm"
                      value={selected.height ?? 20}
                      onChange={(e) => updateNode(selected.id, { height: Number(e.target.value) })}
                    />
                  </div>
                ) : (
                  <div>
                    <label className="label mb-1">Font size (pt)</label>
                    <input
                      type="number"
                      min={6}
                      max={36}
                      className="input text-sm"
                      value={selected.fontSize}
                      onChange={(e) => updateNode(selected.id, { fontSize: Number(e.target.value) })}
                    />
                  </div>
                )}
              </div>

              {selected.fieldKey !== 'box' && (
                <>
                  <div>
                    <label className="label mb-1">Alignment</label>
                    <select
                      className="input text-sm"
                      value={selected.align}
                      onChange={(e) => updateNode(selected.id, { align: e.target.value as SlipNode['align'] })}
                    >
                      <option value="left">Left</option>
                      <option value="center">Center</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={selected.bold}
                      onChange={(e) => updateNode(selected.id, { bold: e.target.checked })}
                    />
                    Bold
                  </label>

                  <div>
                    <label className="label mb-1">Transform</label>
                    <select
                      className="input text-sm"
                      value={selected.transform}
                      onChange={(e) => updateNode(selected.id, { transform: e.target.value as SlipTransform })}
                    >
                      {(Object.keys(TRANSFORM_LABELS) as SlipTransform[]).map((t) => (
                        <option key={t} value={t}>
                          {TRANSFORM_LABELS[t]}
                        </option>
                      ))}
                    </select>
                  </div>

                  {(selected.transform === 'prefix' || selected.transform === 'suffix') && (
                    <div>
                      <label className="label mb-1">{selected.transform === 'prefix' ? 'Text to add before' : 'Text to add after'}</label>
                      <input
                        type="text"
                        className="input text-sm"
                        value={selected.transformArg ?? ''}
                        onChange={(e) => updateNode(selected.id, { transformArg: e.target.value })}
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="card p-4 text-sm text-gray-500">Select a field on the slip to edit it.</div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 pt-4">
        <div className="flex items-center gap-3">
          <button onClick={() => setConfirmReset(true)} className="text-sm font-medium text-gray-500 hover:text-gray-700">
            Reset to default layout
          </button>
          {saved && <p role="status" className="text-sm text-green-700">Saved.</p>}
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Saving…' : 'Save slip design'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        confirming={saving}
        danger={false}
        title="Reset to the default slip layout?"
        description="This discards your custom design and goes back to the built-in layout. You can design a new one again anytime."
        confirmLabel="Reset"
      />
    </div>
  )
}
