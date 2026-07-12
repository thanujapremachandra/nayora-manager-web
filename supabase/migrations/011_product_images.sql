-- A product-level pool of images, separate from any single variant's
-- image_url. Lets you bulk-upload a batch of photos once, then assign them
-- to individual variants by picking from this gallery instead of uploading
-- one-by-one per variant.
CREATE TABLE product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_images_product_id ON product_images(product_id);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authenticated_full" ON product_images FOR ALL TO authenticated USING (true) WITH CHECK (true);
