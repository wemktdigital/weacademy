-- Adicionar campos de instruções de uso e resultados esperados aos agentes
-- Estes campos ajudam os usuários a entenderem como usar cada agente e o que esperar como resultado

ALTER TABLE public.lab_agents 
ADD COLUMN IF NOT EXISTS usage_instructions TEXT,
ADD COLUMN IF NOT EXISTS expected_result TEXT;

-- Comentários para documentação
COMMENT ON COLUMN lab_agents.usage_instructions IS 'Instruções detalhadas de como usar o agente, incluindo exemplos de entrada, formato esperado e dicas de uso';
COMMENT ON COLUMN lab_agents.expected_result IS 'Descrição clara do resultado esperado ao usar este agente, incluindo formato de saída e exemplos';

