-- Adicionar campo attachments à tabela lab_messages
-- Permite armazenar informações sobre arquivos anexados nas mensagens

ALTER TABLE public.lab_messages 
ADD COLUMN IF NOT EXISTS attachments JSONB;

-- Comentário para documentação
COMMENT ON COLUMN lab_messages.attachments IS 'Informações sobre arquivos anexados à mensagem (formato JSON)';

-- Índice para busca por mensagens com attachments (opcional)
CREATE INDEX IF NOT EXISTS idx_lab_messages_has_attachments 
ON lab_messages USING gin (attachments) WHERE attachments IS NOT NULL;

