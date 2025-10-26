-- Tabela de conversas do laboratório de IA
CREATE TABLE IF NOT EXISTS lab_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela de mensagens do laboratório de IA
CREATE TABLE IF NOT EXISTS lab_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES lab_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  is_favorite BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_conversations_user_id ON lab_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_conversations_updated_at ON lab_conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_lab_messages_conversation_id ON lab_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_lab_messages_created_at ON lab_messages(created_at);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_lab_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE lab_conversations
  SET updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para atualizar updated_at quando uma mensagem é inserida
CREATE TRIGGER update_lab_conversation_timestamp
AFTER INSERT ON lab_messages
FOR EACH ROW
EXECUTE FUNCTION update_lab_conversation_updated_at();

-- RLS (Row Level Security)
ALTER TABLE lab_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lab_messages ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lab_conversations
CREATE POLICY "Users can view their own conversations"
  ON lab_conversations
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own conversations"
  ON lab_conversations
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own conversations"
  ON lab_conversations
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own conversations"
  ON lab_conversations
  FOR DELETE
  USING (auth.uid() = user_id);

-- Políticas RLS para lab_messages
CREATE POLICY "Users can view messages from their conversations"
  ON lab_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM lab_conversations
      WHERE lab_conversations.id = lab_messages.conversation_id
      AND lab_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages to their conversations"
  ON lab_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM lab_conversations
      WHERE lab_conversations.id = lab_messages.conversation_id
      AND lab_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update messages from their conversations"
  ON lab_messages
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM lab_conversations
      WHERE lab_conversations.id = lab_messages.conversation_id
      AND lab_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete messages from their conversations"
  ON lab_messages
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM lab_conversations
      WHERE lab_conversations.id = lab_messages.conversation_id
      AND lab_conversations.user_id = auth.uid()
    )
  );

COMMENT ON TABLE lab_conversations IS 'Conversas do Laboratório de IA';
COMMENT ON TABLE lab_messages IS 'Mensagens das conversas do Laboratório de IA';
