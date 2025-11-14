-- Migration: Sistema de Histórico de Performance de Modelos
-- Armazena métricas de execução para melhorar recomendações

CREATE TABLE IF NOT EXISTS lab_model_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  provider VARCHAR(50) NOT NULL,
  model VARCHAR(100) NOT NULL,
  task_category VARCHAR(50) NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL, -- Hash do prompt para identificar similaridade
  latency_ms INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  error_message TEXT,
  quality_score INTEGER CHECK (quality_score >= 0 AND quality_score <= 100), -- Score de qualidade (opcional)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Índices para consultas rápidas
  CONSTRAINT lab_model_performance_user_provider_model_idx 
    UNIQUE (user_id, provider, model, task_category, prompt_hash)
);

CREATE INDEX IF NOT EXISTS idx_lab_model_performance_category 
  ON lab_model_performance(task_category);

CREATE INDEX IF NOT EXISTS idx_lab_model_performance_provider_model 
  ON lab_model_performance(provider, model);

CREATE INDEX IF NOT EXISTS idx_lab_model_performance_created_at 
  ON lab_model_performance(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lab_model_performance_user_id 
  ON lab_model_performance(user_id);

-- RLS Policies
ALTER TABLE lab_model_performance ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seus próprios dados
CREATE POLICY "Users can view their own model performance"
  ON lab_model_performance FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuários podem inserir seus próprios dados
CREATE POLICY "Users can insert their own model performance"
  ON lab_model_performance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: admins podem ver tudo
CREATE POLICY "Admins can view all model performance"
  ON lab_model_performance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor_we', 'gestor')
    )
  );

-- Função para calcular média de performance por modelo/categoria
CREATE OR REPLACE FUNCTION get_model_performance_stats(
  p_task_category VARCHAR DEFAULT NULL,
  p_days INTEGER DEFAULT 30
)
RETURNS TABLE (
  provider VARCHAR,
  model VARCHAR,
  task_category VARCHAR,
  avg_latency_ms NUMERIC,
  avg_cost_usd NUMERIC,
  success_rate NUMERIC,
  total_executions BIGINT,
  avg_quality_score NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    mp.provider,
    mp.model,
    mp.task_category,
    AVG(mp.latency_ms)::NUMERIC(10, 2) as avg_latency_ms,
    AVG(mp.cost_usd)::NUMERIC(10, 6) as avg_cost_usd,
    (COUNT(*) FILTER (WHERE mp.success = true)::NUMERIC / COUNT(*)::NUMERIC * 100)::NUMERIC(5, 2) as success_rate,
    COUNT(*) as total_executions,
    AVG(mp.quality_score)::NUMERIC(5, 2) as avg_quality_score
  FROM lab_model_performance mp
  WHERE 
    (p_task_category IS NULL OR mp.task_category = p_task_category)
    AND mp.created_at >= NOW() - (p_days || ' days')::INTERVAL
  GROUP BY mp.provider, mp.model, mp.task_category
  ORDER BY avg_quality_score DESC NULLS LAST, avg_latency_ms ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comentários
COMMENT ON TABLE lab_model_performance IS 'Armazena histórico de performance de modelos para melhorar recomendações';
COMMENT ON COLUMN lab_model_performance.prompt_hash IS 'Hash SHA256 do prompt para identificar prompts similares';
COMMENT ON COLUMN lab_model_performance.quality_score IS 'Score de qualidade fornecido pelo usuário (0-100)';
COMMENT ON FUNCTION get_model_performance_stats IS 'Retorna estatísticas agregadas de performance por modelo e categoria';

