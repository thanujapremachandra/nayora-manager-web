import type { TypedClient } from '@/lib/supabase/client'

const BUCKET = 'variant-images'
const MAX_DIMENSION = 800
const JPEG_QUALITY = 0.82

async function compressImage(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)

  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height))
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not supported')
  ctx.drawImage(bitmap, 0, 0, width, height)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Image compression failed'))),
      'image/jpeg',
      JPEG_QUALITY
    )
  })
}

export async function uploadVariantImage(
  client: TypedClient,
  variantId: string,
  file: File
): Promise<string> {
  const blob = await compressImage(file)
  const path = `${variantId}/${Date.now()}.jpg`

  const { error } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  const { data } = client.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// Same bucket, different path prefix — the random suffix avoids collisions
// when several files from one bulk-upload land in the same millisecond.
export async function uploadProductImage(client: TypedClient, productId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const suffix = Math.random().toString(36).slice(2, 8)
  const path = `products/${productId}/${Date.now()}-${suffix}.jpg`

  const { error } = await client.storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (error) throw new Error(`Failed to upload image: ${error.message}`)

  const { data } = client.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

export async function deleteStorageImage(client: TypedClient, imageUrl: string): Promise<void> {
  const marker = `/object/public/${BUCKET}/`
  const idx = imageUrl.indexOf(marker)
  if (idx === -1) return
  const path = imageUrl.slice(idx + marker.length)
  await client.storage.from(BUCKET).remove([path])
}
