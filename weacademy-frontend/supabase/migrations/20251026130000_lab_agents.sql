-- Tabela de logs de execução de agentes
CREATE TABLE IF NOT EXISTS lab_agent_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER,
  cost_usd NUMERIC(10, 4),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_lab_agent_logs_user_id ON lab_agent_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_lab_agent_logs_agent_id ON lab_agent_logs(agent_id);
CREATE INDEX IF NOT EXISTS idx_lab_agent_logs_created_at ON lab_agent_logs(created_at DESC);

-- RLS (Row Level Security)
ALTER TABLE lab_agent_logs ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para lab_agent_logs
DROP POLICY IF EXISTS "Users can view their own agent logs" ON lab_agent_logs;
CREATE POLICY "Users can view their own agent logs"
  ON lab_agent_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own agent logs" ON lab_agent_logs;
CREATE POLICY "Users can insert their own agent logs"
  ON lab_agent_logs
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Comentários
COMMENT ON TABLE lab_agent_logs IS 'Logs de execução de agentes especializados';
