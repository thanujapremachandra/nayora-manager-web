import type { TypedClient } from '@/lib/supabase/client'
import type { ProductImage } from '@/lib/supabase/types'
import { uploadProductImage, deleteStorageImage } from '@/lib/db/storage'

export async function listProductImages(client: TypedClient, productId: string): Promise<ProductImage[]> {
  const { data, error } = await client
    .from('product_images')
    .select('*')
    .eq('product_id', productId)
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw new Error(`Failed to load images: ${error.message}`)
  return data
}

// Records an already-uploaded image URL as a new gallery row — used when a
// variant's "upload new" picker path uploads directly, rather than going
// through the bulk addProductImages flow below.
export async function addProductImageRecord(
  client: TypedClient,
  productId: string,
  imageUrl: string,
  position: number
): Promise<void> {
  const { error } = await client.from('product_images').insert({ product_id: productId, image_url: imageUrl, position })
  if (error) throw new Error(`Failed to save image: ${error.message}`)
}

// Uploads every file and inserts one row per image, continuing past any
// individual failure so one bad file doesn't block the rest of the batch.
export async function addProductImages(
  client: TypedClient,
  productId: string,
  files: File[],
  startPosition: number
): Promise<{ added: number; failed: number }> {
  let added = 0
  let failed = 0
  for (let i = 0; i < files.length; i++) {
    try {
      const url = await uploadProductImage(client, productId, files[i])
      const { error } = await client
        .from('product_images')
        .insert({ product_id: productId, image_url: url, position: startPosition + i })
      if (error) throw new Error(error.message)
      added++
    } catch {
      failed++
    }
  }
  return { added, failed }
}

// Also clears image_url on any variant currently pointing at this image, so
// deleting a gallery photo never leaves a variant with a broken reference.
export async function deleteProductImage(client: TypedClient, image: ProductImage): Promise<void> {
  const { error: clearError } = await client
    .from('variants')
    .update({ image_url: null })
    .eq('product_id', image.product_id)
    .eq('image_url', image.image_url)
  if (clearError) throw new Error(`Failed to clear variant references: ${clearError.message}`)

  const { error } = await client.from('product_images').delete().eq('id', image.id)
  if (error) throw new Error(`Failed to delete image: ${error.message}`)

  await deleteStorageImage(client, image.image_url)
}
