'use client'

import { useState } from 'react'
import { gramsToKgG, kgGToGrams } from '@/lib/pricing'
import { keepDigits } from '@/lib/input-format'

interface Props {
  grams: number | null
  onChange: (grams: number | null) => void
}

export function WeightInput({ grams, onChange }: Props) {
  const initial = gramsToKgG(grams)
  const [kg, setKg] = useState(grams === null ? '' : initial.kg.toString())
  const [g, setG] = useState(grams === null ? '' : initial.g.toString())

  function commit(nextKg: string, nextG: string) {
    if (nextKg === '' && nextG === '') {
      onChange(null)
      return
    }
    const total = kgGToGrams(Number(nextKg || 0), Number(nextG || 0))
    // Normalize overflow grams back into kg (e.g. 1500g -> 1kg 500g).
    const normalized = gramsToKgG(total)
    setKg(normalized.kg.toString())
    setG(normalized.g.toString())
    onChange(total)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        min={0}
        placeholder="0"
        className="input w-20"
        value={kg}
        onChange={(e) => setKg(keepDigits(e.target.value))}
        onBlur={() => commit(kg, g)}
        aria-label="Weight (kg)"
      />
      <span className="text-sm text-gray-500">kg</span>
      <input
        type="number"
        min={0}
        max={999}
        placeholder="0"
        className="input w-20"
        value={g}
        onChange={(e) => setG(keepDigits(e.target.value))}
        onBlur={() => commit(kg, g)}
        aria-label="Weight (g)"
      />
      <span className="text-sm text-gray-500">g</span>
    </div>
  )
}
