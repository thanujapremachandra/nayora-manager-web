'use client'

import { useRef, useState } from 'react'
import { Dialog } from '@/components/ui/dialog'
import type { ProductImage } from '@/lib/supabase/types'

interface Props {
  open: boolean
  onClose: () => void
  images: ProductImage[]
  currentUrl: string | null
  onPick: (url: string) => Promise<void>
  onUploadNew: (file: File) => Promise<void>
}

// Picking an image for a variant has two paths: choose one already in the
// product's gallery (fast — no re-upload), or upload a new file from
// device, which also adds it to the gallery for future variants to reuse.
export function VariantImagePicker({ open, onClose, images, currentUrl, onPick, onUploadNew }: Props) {
  const [picking, setPicking] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handlePick(url: string) {
    setPicking(url)
    try {
      await onPick(url)
      onClose()
    } finally {
      setPicking(null)
    }
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      await onUploadNew(file)
      onClose()
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Choose image">
      <div className="space-y-3">
        {images.length > 0 ? (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {images.map((image) => (
              <button
                key={image.id}
                type="button"
                onClick={() => handlePick(image.image_url)}
                disabled={picking !== null}
                className={`relative aspect-square overflow-hidden rounded-lg border-2 ${
                  currentUrl === image.image_url ? 'border-brand-500' : 'border-gray-200 hover:border-brand-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.image_url} alt="" className="h-full w-full object-cover" />
                {picking === image.image_url && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/70 text-xs">…</div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">No images in this product&apos;s gallery yet.</p>
        )}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="btn-secondary w-full text-sm"
        >
          {uploading ? 'Uploading…' : 'Upload new from device'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
      </div>
    </Dialog>
  )
}
