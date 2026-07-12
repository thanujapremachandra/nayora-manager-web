'use client'

import { useRef, useState } from 'react'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import type { ProductImage } from '@/lib/supabase/types'

interface Props {
  images: ProductImage[]
  onUpload: (files: File[]) => Promise<{ added: number; failed: number }>
  onDelete: (image: ProductImage) => Promise<void>
}

// The shared gallery grid used both in ProductDialog (bulk upload + CRUD)
// and inside VariantImagePicker (pick-only, no upload/delete controls there
// since that dialog reuses this same grid just to choose an existing image).
export function ProductImageGallery({ images, onUpload, onDelete }: Props) {
  const [uploading, setUploading] = useState(false)
  const [uploadNotice, setUploadNotice] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ProductImage | null>(null)
  const [deleting, setDeleting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return
    setUploading(true)
    setUploadNotice(null)
    try {
      const { failed } = await onUpload(files)
      setUploadNotice(failed > 0 ? `${failed} image(s) failed to upload.` : null)
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await onDelete(deleteTarget)
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {images.map((image) => (
          <div key={image.id} className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.image_url} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setDeleteTarget(image)}
              aria-label="Delete image"
              className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs text-white group-hover:flex"
            >
              ×
            </button>
          </div>
        ))}

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex aspect-square flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 text-gray-400 hover:border-brand-300 hover:text-brand-600"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-5 w-5" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
          </svg>
          <span className="text-[10px]">{uploading ? 'Uploading…' : 'Add images'}</span>
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
      {uploadNotice && <p className="mt-1 text-xs text-gray-500">{uploadNotice}</p>}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        confirming={deleting}
        title="Delete this image?"
        description="Removes it from the gallery and clears it from any variant currently using it. This cannot be undone."
        confirmLabel="Delete"
      />
    </div>
  )
}
