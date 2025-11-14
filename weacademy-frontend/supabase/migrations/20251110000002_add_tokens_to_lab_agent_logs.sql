-- Adicionar colunas de tokens em lab_agent_logs
ALTER TABLE public.lab_agent_logs 
ADD COLUMN IF NOT EXISTS input_tokens INTEGER,
ADD COLUMN IF NOT EXISTS output_tokens INTEGER;

-- Criar índice para consultas de tokens
CREATE INDEX IF NOT EXISTS idx_lab_agent_logs_tokens 
ON lab_agent_logs(input_tokens, output_tokens) 
WHERE input_tokens IS NOT NULL OR output_tokens IS NOT NULL;

-- Comentários
COMMENT ON COLUMN lab_agent_logs.input_tokens IS 'Número de tokens de entrada processados nesta execução';
COMMENT ON COLUMN lab_agent_logs.output_tokens IS 'Número de tokens de saída gerados nesta execução';

