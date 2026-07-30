-- ============================================
-- 024: Food Images Storage
-- Creates food-images bucket + RLS policies
-- ============================================

-- 1. Create the storage bucket (public, with file size limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'food-images',
  'food-images',
  true,
  5242880,  -- 5MB per file
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- 2. RLS: Allow SELECT for anyone (public bucket)
DROP POLICY IF EXISTS "Public read food-images" ON storage.objects;
CREATE POLICY "Public read food-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'food-images');

-- 3. RLS: Allow INSERT for authenticated users (own folder)
DROP POLICY IF EXISTS "Users can upload food-images" ON storage.objects;
CREATE POLICY "Users can upload food-images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'food-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- 4. RLS: Allow DELETE for authenticated users (own folder)
DROP POLICY IF EXISTS "Users can delete own food-images" ON storage.objects;
CREATE POLICY "Users can delete own food-images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'food-images'
    AND auth.role() = 'authenticated'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
