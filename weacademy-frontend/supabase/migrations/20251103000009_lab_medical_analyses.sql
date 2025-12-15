-- Migration: Tabela para armazenar análises médicas multi-modais
-- Created: 2025-11-03

CREATE TABLE IF NOT EXISTS public.lab_medical_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('image', 'audio', 'video')),
  
  -- Campos para imagens
  image_type TEXT CHECK (image_type IN ('xray', 'mri', 'ct', 'ultrasound', 'dermatology', 'general')),
  image_url TEXT,
  findings TEXT[],
  diagnosis TEXT,
  recommendations TEXT[],
  confidence DECIMAL(5,2),
  annotated_regions JSONB,
  similar_cases JSONB,
  
  -- Campos para áudio
  audio_url TEXT,
  transcription TEXT,
  sentiment TEXT CHECK (sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  summary TEXT,
  key_points TEXT[],
  detected_events JSONB,
  
  -- Campos para vídeo
  video_url TEXT,
  procedure_type TEXT,
  segments JSONB,
  key_moments JSONB,
  
  -- Metadados
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_lab_medical_analyses_user_id ON public.lab_medical_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_medical_analyses_type ON public.lab_medical_analyses(analysis_type);
CREATE INDEX IF NOT EXISTS idx_lab_medical_analyses_created_at ON public.lab_medical_analyses(created_at DESC);

-- RLS Policies
ALTER TABLE public.lab_medical_analyses ENABLE ROW LEVEL SECURITY;

-- Usuários podem ver apenas suas próprias análises
DROP POLICY IF EXISTS "Users can view their own medical analyses" ON public.lab_medical_analyses;
CREATE POLICY "Users can view their own medical analyses"
  ON public.lab_medical_analyses
  FOR SELECT
  USING (auth.uid() = user_id);

-- Usuários podem inserir suas próprias análises
DROP POLICY IF EXISTS "Users can insert their own medical analyses" ON public.lab_medical_analyses;
CREATE POLICY "Users can insert their own medical analyses"
  ON public.lab_medical_analyses
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins podem ver todas as análises
DROP POLICY IF EXISTS "Admins can view all medical analyses" ON public.lab_medical_analyses;
CREATE POLICY "Admins can view all medical analyses"
  ON public.lab_medical_analyses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() 
      AND role IN ('admin', 'gestor_we', 'gestor')
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_medical_analyses_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_lab_medical_analyses_updated_at ON public.lab_medical_analyses;
CREATE TRIGGER update_lab_medical_analyses_updated_at
  BEFORE UPDATE ON public.lab_medical_analyses
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_medical_analyses_updated_at();

-- Comentários
COMMENT ON TABLE public.lab_medical_analyses IS 'Análises médicas multi-modais (imagens, áudio, vídeo)';
COMMENT ON COLUMN public.lab_medical_analyses.analysis_type IS 'Tipo de análise: image, audio ou video';
COMMENT ON COLUMN public.lab_medical_analyses.image_type IS 'Tipo de imagem médica: xray, mri, ct, ultrasound, dermatology, general';
COMMENT ON COLUMN public.lab_medical_analyses.confidence IS 'Confiança na análise (0.00 a 1.00)';
COMMENT ON COLUMN public.lab_medical_analyses.annotated_regions IS 'Regiões anotadas na imagem em formato JSON';
COMMENT ON COLUMN public.lab_medical_analyses.similar_cases IS 'Casos similares encontrados na knowledge base';
COMMENT ON COLUMN public.lab_medical_analyses.detected_events IS 'Eventos detectados no áudio (dor, ansiedade, urgência, etc)';
COMMENT ON COLUMN public.lab_medical_analyses.segments IS 'Segmentos do vídeo por tópico';
COMMENT ON COLUMN public.lab_medical_analyses.key_moments IS 'Momentos-chave do procedimento';

