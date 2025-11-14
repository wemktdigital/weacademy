-- Criar bucket para thumbnails de cursos
-- Execute este script no Supabase SQL Editor ou via CLI

-- Inserir bucket na tabela storage.buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-thumbnails',
  'course-thumbnails',
  true, -- Bucket público
  5242880, -- 5MB em bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Criar política para permitir upload autenticado
CREATE POLICY "Allow authenticated uploads to course-thumbnails"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'course-thumbnails');

-- Criar política para permitir leitura pública
CREATE POLICY "Allow public read access to course-thumbnails"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'course-thumbnails');

-- Criar política para permitir que usuários atualizem seus próprios arquivos
CREATE POLICY "Allow users to update their own course-thumbnails"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'course-thumbnails');

-- Criar política para permitir que usuários deletem seus próprios arquivos
CREATE POLICY "Allow users to delete their own course-thumbnails"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'course-thumbnails');

