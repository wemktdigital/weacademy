-- Migration: Histórico de Recomendações Aceitas
-- Armazena quando usuários aceitam recomendações de modelos

CREATE TABLE IF NOT EXISTS lab_model_recommendations_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  original_provider VARCHAR(50) NOT NULL,
  original_model VARCHAR(100) NOT NULL,
  recommended_provider VARCHAR(50) NOT NULL,
  recommended_model VARCHAR(100) NOT NULL,
  recommendation_score INTEGER NOT NULL CHECK (recommendation_score >= 0 AND recommendation_score <= 100),
  recommendation_reason TEXT,
  task_category VARCHAR(50),
  prompt_preview TEXT, -- Primeiros 200 caracteres do prompt
  accepted BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Índices
  CONSTRAINT lab_model_recommendations_user_idx 
    UNIQUE (user_id, original_provider, original_model, recommended_provider, recommended_model, created_at)
);

CREATE INDEX IF NOT EXISTS idx_lab_model_recommendations_user_id 
  ON lab_model_recommendations_history(user_id);

CREATE INDEX IF NOT EXISTS idx_lab_model_recommendations_category 
  ON lab_model_recommendations_history(task_category);

CREATE INDEX IF NOT EXISTS idx_lab_model_recommendations_created_at 
  ON lab_model_recommendations_history(created_at DESC);

-- RLS Policies
ALTER TABLE lab_model_recommendations_history ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas seus próprios dados
CREATE POLICY "Users can view their own recommendations history"
  ON lab_model_recommendations_history FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuários podem inserir seus próprios dados
CREATE POLICY "Users can insert their own recommendations history"
  ON lab_model_recommendations_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: admins podem ver tudo
CREATE POLICY "Admins can view all recommendations history"
  ON lab_model_recommendations_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'gestor_we', 'gestor')
    )
  );

-- Tabela de Preferências de Routing do Usuário
CREATE TABLE IF NOT EXISTS lab_user_routing_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  intelligent_routing_enabled BOOLEAN NOT NULL DEFAULT true,
  max_cost_usd DECIMAL(10, 6),
  prefer_speed BOOLEAN DEFAULT false,
  prefer_accuracy BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lab_user_routing_preferences_user_id 
  ON lab_user_routing_preferences(user_id);

-- RLS Policies
ALTER TABLE lab_user_routing_preferences ENABLE ROW LEVEL SECURITY;

-- Política: usuários podem ver apenas suas próprias preferências
CREATE POLICY "Users can view their own routing preferences"
  ON lab_user_routing_preferences FOR SELECT
  USING (auth.uid() = user_id);

-- Política: usuários podem inserir suas próprias preferências
CREATE POLICY "Users can insert their own routing preferences"
  ON lab_user_routing_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Política: usuários podem atualizar suas próprias preferências
CREATE POLICY "Users can update their own routing preferences"
  ON lab_user_routing_preferences FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_lab_user_routing_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_lab_user_routing_preferences_updated_at
  BEFORE UPDATE ON lab_user_routing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_lab_user_routing_preferences_updated_at();

-- Comentários
COMMENT ON TABLE lab_model_recommendations_history IS 'Histórico de recomendações de modelos aceitas pelos usuários';
COMMENT ON TABLE lab_user_routing_preferences IS 'Preferências pessoais de routing inteligente do usuário';

