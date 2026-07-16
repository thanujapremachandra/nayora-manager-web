'use client'

import { useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateSettings } from '@/lib/db/settings'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CustomSlipNodes } from '@/components/print/custom-slip-front'
import { SLIP_BOX_WIDTH_MM, SLIP_BOX_HEIGHT_MM, sampleSlipContext } from '@/lib/slip-template'
import {
  pageDimensionsMm,
  backPlacementFor,
  createSlipPlacement,
  clampPlacement,
} from '@/lib/slip-placement'
import type { Settings, SlipPlacement, SlipPlacementLayout, DuplexFlipAxis } from '@/lib/supabase/types'

interface Props {
  settings: Settings
}

const DEFAULT_LAYOUT: SlipPlacementLayout = { orientation: 'portrait', duplexFlipAxis: 'long-edge', placements: [] }

// Fits the (variable-size) A4 page comfortably on screen for editing —
// unlike the content designer, which zooms a small box UP, this zooms a
// full page DOWN.
const PAGE_ZOOM = 0.65

export function SlipPlacementDesigner({ settings: initialSettings }: Props) {
  const [settings, setSettings] = useState(initialSettings)
  const [layout, setLayout] = useState<SlipPlacementLayout>(initialSettings.slip_placement_layout ?? DEFAULT_LAYOUT)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const canvasRef = useRef<HTMLDivElement>(null)

  const page = pageDimensionsMm(layout.orientation)
  const ctx = sampleSlipContext(settings)
  const selected = layout.placements.find((p) => p.id === selectedId) ?? null

  function updatePlacements(fn: (placements: SlipPlacement[]) => SlipPlacement[]) {
    setLayout((prev) => ({ ...prev, placements: fn(prev.placements) }))
  }

  function updatePlacement(id: string, patch: Partial<SlipPlacement>) {
    updatePlacements((placements) =>
      placements.map((p) => (p.id === id ? clampPlacement({ ...p, ...patch }, page.width, page.height) : p))
    )
  }

  function handleAddPlacement() {
    const p = clampPlacement(createSlipPlacement(10, 10), page.width, page.height)
    updatePlacements((placements) => [...placements, p])
    setSelectedId(p.id)
  }

  function removePlacement(id: string) {
    updatePlacements((placements) => placements.filter((p) => p.id !== id))
    if (selectedId === id) setSelectedId(null)
  }

  function handleDragStart(placement: SlipPlacement, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    setSelectedId(placement.id)
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pxPerMm = rect.width / page.width
    const startX = e.clientX
    const startY = e.clientY
    const originX = placement.x
    const originY = placement.y

    function handleMove(ev: PointerEvent) {
      const dxMm = (ev.clientX - startX) / pxPerMm
      const dyMm = (ev.clientY - startY) / pxPerMm
      updatePlacement(placement.id, { x: originX + dxMm, y: originY + dyMm })
    }
    function handleUp() {
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', handleMove)
      target.removeEventListener('pointerup', handleUp)
    }
    target.addEventListener('pointermove', handleMove)
    target.addEventListener('pointerup', handleUp)
  }

  function handleResizeStart(placement: SlipPlacement, e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation()
    setSelectedId(placement.id)
    const target = e.currentTarget
    target.setPointerCapture(e.pointerId)
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return
    const pxPerMm = rect.width / page.width
    const startX = e.clientX
    const startY = e.clientY
    const originWidth = placement.width
    const originHeight = placement.height

    function handleMove(ev: PointerEvent) {
      const dxMm = (ev.clientX - startX) / pxPerMm
      const dyMm = (ev.clientY - startY) / pxPerMm
      updatePlacement(placement.id, { width: originWidth + dxMm, height: originHeight + dyMm })
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
      const updated = await updateSettings(createClient(), settings.id, { slip_placement_layout: layout })
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
      const updated = await updateSettings(createClient(), settings.id, { slip_placement_layout: null })
      setSettings(updated)
      setLayout(DEFAULT_LAYOUT)
      setSelectedId(null)
    } finally {
      setSaving(false)
      setConfirmReset(false)
    }
  }

  function renderMiniSlip(p: SlipPlacement, label: string) {
    const scaleX = p.width / SLIP_BOX_WIDTH_MM
    const scaleY = p.height / SLIP_BOX_HEIGHT_MM
    return (
      <div
        key={p.id}
        className="absolute overflow-hidden border border-gray-400 bg-white text-black"
        style={{ left: `${p.x}mm`, top: `${p.y}mm`, width: `${p.width}mm`, height: `${p.height}mm` }}
      >
        <div
          className="relative origin-top-left"
          style={{ width: `${SLIP_BOX_WIDTH_MM}mm`, height: `${SLIP_BOX_HEIGHT_MM}mm`, transform: `scale(${scaleX}, ${scaleY})` }}
        >
          {settings.slip_template ? (
            <CustomSlipNodes template={settings.slip_template} ctx={ctx} />
          ) : (
            <p className="p-2 text-[8pt] text-gray-400">{label}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Place and size as many slips as you like on the sheet — drag to move, drag the bottom-right
        handle to resize. The back page is generated automatically so it lines up under duplex
        printing; you don&apos;t place it yourself. Uses whatever front design you saved in Slip
        Designer.
      </p>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="label">Page:</span>
          {(['portrait', 'landscape'] as const).map((o) => (
            <button
              key={o}
              onClick={() => setLayout((prev) => ({ ...prev, orientation: o }))}
              className={`rounded-full border px-3 py-1 text-xs font-medium capitalize ${
                layout.orientation === o ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-300 text-gray-600'
              }`}
            >
              {o}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="label">Duplex flip:</span>
          <select
            className="input w-auto py-1 text-xs"
            value={layout.duplexFlipAxis}
            onChange={(e) => setLayout((prev) => ({ ...prev, duplexFlipAxis: e.target.value as DuplexFlipAxis }))}
          >
            <option value="long-edge">Long edge (standard default)</option>
            <option value="short-edge">Short edge</option>
          </select>
        </div>

        <button onClick={handleAddPlacement} className="btn-secondary py-1.5 text-sm">
          + Add slip
        </button>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="space-y-4">
          {/* Front (editable) */}
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Front — drag to arrange</p>
            <div className="inline-block overflow-auto rounded-lg bg-gray-100 p-4">
              <div style={{ width: `${page.width * PAGE_ZOOM}mm`, height: `${page.height * PAGE_ZOOM}mm` }}>
                <div
                  ref={canvasRef}
                  className="relative origin-top-left bg-white text-black shadow"
                  style={{ width: `${page.width}mm`, height: `${page.height}mm`, border: '1px solid #999', transform: `scale(${PAGE_ZOOM})` }}
                  onPointerDown={() => setSelectedId(null)}
                >
                  {layout.placements.map((p) => (
                    <div
                      key={p.id}
                      onPointerDown={(e) => handleDragStart(p, e)}
                      className={`absolute cursor-move ${selectedId === p.id ? 'ring-2 ring-brand-500' : ''}`}
                      style={{ left: `${p.x}mm`, top: `${p.y}mm`, width: `${p.width}mm`, height: `${p.height}mm` }}
                    >
                      {renderMiniSlip({ ...p, x: 0, y: 0 }, 'Slip front')}
                      <div
                        onPointerDown={(e) => handleResizeStart(p, e)}
                        className="absolute -bottom-1.5 -right-1.5 h-3 w-3 cursor-nwse-resize rounded-sm border border-white bg-brand-500"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Back (auto-generated preview, read-only) */}
          <div>
            <p className="mb-1 text-xs font-medium text-gray-500">Back — generated automatically</p>
            <div className="inline-block overflow-auto rounded-lg bg-gray-100 p-4">
              <div style={{ width: `${page.width * PAGE_ZOOM}mm`, height: `${page.height * PAGE_ZOOM}mm` }}>
                <div
                  className="relative origin-top-left bg-white text-black shadow"
                  style={{ width: `${page.width}mm`, height: `${page.height}mm`, border: '1px solid #999', transform: `scale(${PAGE_ZOOM})` }}
                >
                  {layout.placements.map((p) => renderMiniSlip(backPlacementFor(p, layout), 'Slip back'))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Properties panel */}
        <div className="w-full shrink-0 lg:w-56">
          {selected ? (
            <div className="card space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-gray-900">Slip</p>
                <button onClick={() => removePlacement(selected.id)} className="text-xs font-medium text-red-600 hover:text-red-700">
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label mb-1">X (mm)</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={Math.round(selected.x)}
                    onChange={(e) => updatePlacement(selected.id, { x: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label mb-1">Y (mm)</label>
                  <input
                    type="number"
                    className="input text-sm"
                    value={Math.round(selected.y)}
                    onChange={(e) => updatePlacement(selected.id, { y: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label mb-1">Width (mm)</label>
                  <input
                    type="number"
                    min={30}
                    className="input text-sm"
                    value={Math.round(selected.width)}
                    onChange={(e) => updatePlacement(selected.id, { width: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="label mb-1">Height (mm)</label>
                  <input
                    type="number"
                    min={30}
                    className="input text-sm"
                    value={Math.round(selected.height)}
                    onChange={(e) => updatePlacement(selected.id, { height: Number(e.target.value) })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="card p-4 text-sm text-gray-500">
              Select a slip to edit it, or click &quot;+ Add slip&quot; to place a new one.
            </div>
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
          {saving ? 'Saving…' : 'Save placement'}
        </button>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={handleReset}
        confirming={saving}
        danger={false}
        title="Reset to the default placement?"
        description="This discards your custom layout and goes back to the built-in single-column placement (3 per page, portrait)."
        confirmLabel="Reset"
      />
    </div>
  )
}
