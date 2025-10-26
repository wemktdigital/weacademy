-- WE Academy - Completa estrutura de cursos
-- Migration: 20241020000009_complete_courses.sql

-- Adicionar campos faltantes na tabela courses
ALTER TABLE public.courses
ADD COLUMN IF NOT EXISTS video_url TEXT,
ADD COLUMN IF NOT EXISTS video_provider TEXT CHECK (video_provider IN ('youtube', 'vimeo', 'custom')),
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));

-- Adicionar campo de ordem para módulos (já existe, mas garantir)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'modules' AND column_name = 'order_index') THEN
        ALTER TABLE public.modules ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Adicionar campos na tabela lessons
ALTER TABLE public.lessons
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'video' CHECK (type IN ('video', 'text', 'pdf', 'quiz', 'audio')),
ADD COLUMN IF NOT EXISTS video_provider TEXT CHECK (video_provider IN ('youtube', 'vimeo')),
ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS is_free BOOLEAN DEFAULT false;

-- Comentários nas colunas
COMMENT ON COLUMN public.courses.video_url IS 'URL do vídeo de introdução do curso';
COMMENT ON COLUMN public.courses.video_provider IS 'Provedor de vídeo (youtube, vimeo, custom)';
COMMENT ON COLUMN public.courses.status IS 'Status do curso (draft, published, archived)';
COMMENT ON COLUMN public.lessons.type IS 'Tipo de lição (video, text, pdf, quiz, audio)';
COMMENT ON COLUMN public.lessons.video_provider IS 'Provedor do vídeo da lição';
COMMENT ON COLUMN public.lessons.attachments IS 'Arquivos anexos (PDFs, imagens, etc)';
COMMENT ON COLUMN public.lessons.is_free IS 'Se a lição é gratuita (preview)';

-- Criar índice para busca por status
CREATE INDEX IF NOT EXISTS idx_courses_status ON public.courses(status);
CREATE INDEX IF NOT EXISTS idx_lessons_type ON public.lessons(type);

-- RLS para novos campos
-- As políticas já existem cobrem os novos campos
