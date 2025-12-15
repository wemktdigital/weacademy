-- Migration: Sistema de Feedback de Modelos
-- Registra avaliações explícitas dos usuários sobre recomendações automáticas

CREATE TABLE IF NOT EXISTS public.lab_model_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message_id UUID REFERENCES lab_messages(id) ON DELETE SET NULL,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  original_provider VARCHAR(50),
  original_model VARCHAR(100),
  task_category VARCHAR(50),
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, message_id)
);

CREATE INDEX IF NOT EXISTS idx_lab_model_feedback_user_id
  ON public.lab_model_feedback(user_id);

CREATE INDEX IF NOT EXISTS idx_lab_model_feedback_model
  ON public.lab_model_feedback(provider, model);

CREATE INDEX IF NOT EXISTS idx_lab_model_feedback_category
  ON public.lab_model_feedback(task_category);

ALTER TABLE public.lab_model_feedback ENABLE ROW LEVEL SECURITY;

-- Política: usuário vê apenas seus feedbacks
DROP POLICY IF EXISTS "Users can view their own model feedback" ON public.lab_model_feedback;
CREATE POLICY "Users can view their own model feedback"
  ON public.lab_model_feedback FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuário pode inserir/atualizar seus feedbacks
DROP POLICY IF EXISTS "Users can insert their own model feedback" ON public.lab_model_feedback;
CREATE POLICY "Users can insert their own model feedback"
  ON public.lab_model_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own model feedback" ON public.lab_model_feedback;
CREATE POLICY "Users can update their own model feedback"
  ON public.lab_model_feedback FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own model feedback" ON public.lab_model_feedback;
CREATE POLICY "Users can delete their own model feedback"
  ON public.lab_model_feedback FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.lab_model_feedback IS 'Feedback explícito dos usuários sobre modelos selecionados automaticamente pelo routing inteligente.';

