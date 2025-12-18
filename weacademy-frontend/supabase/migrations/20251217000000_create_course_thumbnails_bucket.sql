-- WE Academy - Configuração do Storage para Thumbnails de Cursos
-- Criado em: 2025-12-17

-- Criar bucket para course-thumbnails se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('course-thumbnails', 'course-thumbnails', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de segurança (opcional, pois o upload é via service_role, mas boa prática para leitura pública)

-- Permitir leitura pública
CREATE POLICY "Thumbnails are publicly viewable" ON storage.objects
FOR SELECT USING (bucket_id = 'course-thumbnails');

-- Permitir upload apenas para admins e instrutores (via RLS se tentarem direto, mas via API é service_role)
-- Mas vamos deixar uma política basica de authenticated se quisermos permitir direto no futuro
CREATE POLICY "Authenticated users can upload thumbnails" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'course-thumbnails'
  AND auth.role() = 'authenticated'
);

-- Permitir update/delete para quem criou ou admins (simplificado: authenticated)
CREATE POLICY "Users can update their own thumbnails" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'course-thumbnails'
  AND auth.uid() = owner
);

CREATE POLICY "Users can delete their own thumbnails" ON storage.objects
FOR DELETE USING (
  bucket_id = 'course-thumbnails'
  AND auth.uid() = owner
);
