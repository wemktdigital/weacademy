-- Tabela para operações assíncronas de geração de vídeo (VEO 3.1)
-- Migration: 20241115000000_lab_video_operations.sql

CREATE TABLE IF NOT EXISTS lab_video_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES lab_conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES lab_messages(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  prompt TEXT NOT NULL,
  operation_name TEXT NOT NULL, -- Nome da operação do Google (ex: "operations/123456789")
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  video_url TEXT, -- URI do vídeo retornado pela API do Google
  video_data_url TEXT, -- Base64 do vídeo baixado
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_video_operations_user_id ON lab_video_operations(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_video_operations_status ON lab_video_operations(status);
CREATE INDEX IF NOT EXISTS idx_lab_video_operations_conversation_id ON lab_video_operations(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lab_video_operations_message_id ON lab_video_operations(message_id);
CREATE INDEX IF NOT EXISTS idx_lab_video_operations_operation_name ON lab_video_operations(operation_name);
CREATE INDEX IF NOT EXISTS idx_lab_video_operations_created_at ON lab_video_operations(created_at DESC);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_lab_video_operation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at quando uma operação é atualizada
CREATE TRIGGER update_lab_video_operation_timestamp
BEFORE UPDATE ON lab_video_operations
FOR EACH ROW
EXECUTE FUNCTION update_lab_video_operation_updated_at();

-- Função para atualizar completed_at quando status muda para 'completed' ou 'failed'
CREATE OR REPLACE FUNCTION update_lab_video_operation_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('completed', 'failed') AND OLD.status NOT IN ('completed', 'failed') THEN
    NEW.completed_at = NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar completed_at automaticamente
CREATE TRIGGER update_lab_video_operation_completed_at_trigger
BEFORE UPDATE ON lab_video_operations
FOR EACH ROW
EXECUTE FUNCTION update_lab_video_operation_completed_at();

-- RLS (Row Level Security)
ALTER TABLE lab_video_operations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lab_video_operations
CREATE POLICY "Users can view their own video operations"
  ON lab_video_operations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own video operations"
  ON lab_video_operations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own video operations"
  ON lab_video_operations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own video operations"
  ON lab_video_operations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE lab_video_operations IS 'Armazena operações assíncronas de geração de vídeo com VEO 3.1';
COMMENT ON COLUMN lab_video_operations.operation_name IS 'Nome da operação retornado pela API do Google Gemini (ex: "operations/123456789")';
COMMENT ON COLUMN lab_video_operations.status IS 'Status da operação: pending, processing, completed, failed';
COMMENT ON COLUMN lab_video_operations.video_url IS 'URI do vídeo retornado pela API do Google (disponível por 2 dias)';
COMMENT ON COLUMN lab_video_operations.video_data_url IS 'Vídeo convertido para base64 (data:video/mp4;base64,...)';

