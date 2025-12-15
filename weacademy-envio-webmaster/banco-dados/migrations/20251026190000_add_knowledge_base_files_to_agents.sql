-- Adicionar coluna para armazenar referências de arquivos de conhecimento
ALTER TABLE public.lab_agents 
ADD COLUMN IF NOT EXISTS knowledge_base_files JSONB DEFAULT '[]'::jsonb;

-- Adicionar comentário explicativo
COMMENT ON COLUMN lab_agents.knowledge_base_files IS 'Array JSON com referências aos arquivos de conhecimento: [{"name": "arquivo.pdf", "url": "https://..."}]';

-- Criar índice para buscas por arquivos (opcional, útil se quiser buscar agentes que têm arquivos)
CREATE INDEX IF NOT EXISTS idx_lab_agents_has_knowledge_files 
ON lab_agents USING gin (knowledge_base_files) WHERE knowledge_base_files != '[]'::jsonb;

