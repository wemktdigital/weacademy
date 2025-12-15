-- Criar bucket para imagens médicas
-- Migration: 2025-11-03

-- Criar bucket para imagens médicas
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-medical-images',
  'lab-medical-images',
  true, -- Bucket público
  52428800, -- 50MB em bytes (imagens médicas podem ser grandes)
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/dicom', 'image/tiff']
)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para áudio médico
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-medical-audio',
  'lab-medical-audio',
  true,
  104857600, -- 100MB em bytes
  ARRAY['audio/mpeg', 'audio/wav', 'audio/mp4', 'audio/webm', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Criar bucket para vídeos médicos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-medical-videos',
  'lab-medical-videos',
  true,
  524288000, -- 500MB em bytes
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas para lab-medical-images
DROP POLICY IF EXISTS "Allow authenticated uploads to lab-medical-images" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to lab-medical-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lab-medical-images');

DROP POLICY IF EXISTS "Allow public read access to lab-medical-images" ON storage.objects;
CREATE POLICY "Allow public read access to lab-medical-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lab-medical-images');

DROP POLICY IF EXISTS "Allow users to update their own lab-medical-images" ON storage.objects;
CREATE POLICY "Allow users to update their own lab-medical-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lab-medical-images');

DROP POLICY IF EXISTS "Allow users to delete their own lab-medical-images" ON storage.objects;
CREATE POLICY "Allow users to delete their own lab-medical-images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lab-medical-images');

-- Políticas para lab-medical-audio
DROP POLICY IF EXISTS "Allow authenticated uploads to lab-medical-audio" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to lab-medical-audio"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lab-medical-audio');

DROP POLICY IF EXISTS "Allow public read access to lab-medical-audio" ON storage.objects;
CREATE POLICY "Allow public read access to lab-medical-audio"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lab-medical-audio');

DROP POLICY IF EXISTS "Allow users to update their own lab-medical-audio" ON storage.objects;
CREATE POLICY "Allow users to update their own lab-medical-audio"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lab-medical-audio');

DROP POLICY IF EXISTS "Allow users to delete their own lab-medical-audio" ON storage.objects;
CREATE POLICY "Allow users to delete their own lab-medical-audio"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lab-medical-audio');

-- Políticas para lab-medical-videos
DROP POLICY IF EXISTS "Allow authenticated uploads to lab-medical-videos" ON storage.objects;
CREATE POLICY "Allow authenticated uploads to lab-medical-videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lab-medical-videos');

DROP POLICY IF EXISTS "Allow public read access to lab-medical-videos" ON storage.objects;
CREATE POLICY "Allow public read access to lab-medical-videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'lab-medical-videos');

DROP POLICY IF EXISTS "Allow users to update their own lab-medical-videos" ON storage.objects;
CREATE POLICY "Allow users to update their own lab-medical-videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'lab-medical-videos');

DROP POLICY IF EXISTS "Allow users to delete their own lab-medical-videos" ON storage.objects;
CREATE POLICY "Allow users to delete their own lab-medical-videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'lab-medical-videos');

