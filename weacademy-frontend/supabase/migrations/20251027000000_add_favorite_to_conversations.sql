-- Adicionar campo is_favorite na tabela lab_conversations
ALTER TABLE lab_conversations 
ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;

-- Criar índice para performance ao filtrar favoritos
CREATE INDEX IF NOT EXISTS idx_lab_conversations_is_favorite 
ON lab_conversations(user_id, is_favorite) 
WHERE is_favorite = TRUE;

