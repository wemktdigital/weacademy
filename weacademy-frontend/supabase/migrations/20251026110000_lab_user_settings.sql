-- Tabela de preferências do usuário no laboratório de IA
CREATE TABLE IF NOT EXISTS lab_user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  preferred_provider TEXT,
  preferred_model TEXT,
  temperature NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_lab_user_settings_user_id ON lab_user_settings(user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_lab_user_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_lab_user_settings_updated_at ON lab_user_settings;
CREATE TRIGGER update_lab_user_settings_updated_at
BEFORE UPDATE ON lab_user_settings
FOR EACH ROW
EXECUTE FUNCTION update_lab_user_settings_timestamp();

-- RLS (Row Level Security)
ALTER TABLE lab_user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
DROP POLICY IF EXISTS "Users can view their own settings" ON lab_user_settings;
CREATE POLICY "Users can view their own settings"
  ON lab_user_settings
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own settings" ON lab_user_settings;
CREATE POLICY "Users can insert their own settings"
  ON lab_user_settings
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own settings" ON lab_user_settings;
CREATE POLICY "Users can update their own settings"
  ON lab_user_settings
  FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own settings" ON lab_user_settings;
CREATE POLICY "Users can delete their own settings"
  ON lab_user_settings
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE lab_user_settings IS 'Preferências do usuário no Laboratório de IA';
