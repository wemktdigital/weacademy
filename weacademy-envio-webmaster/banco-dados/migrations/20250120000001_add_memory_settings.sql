-- Adicionar campos de configuração de memória na tabela lab_user_settings
-- Permite ao usuário controlar o uso de memória no Laboratório de IA

ALTER TABLE lab_user_settings 
ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS memory_auto_extract BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS memory_reference_history BOOLEAN DEFAULT false;

-- Comentários para documentação
COMMENT ON COLUMN lab_user_settings.memory_enabled IS 'Ativa ou desativa o uso de memória global em todas as conversas';
COMMENT ON COLUMN lab_user_settings.memory_auto_extract IS 'Permite extração automática de memórias das conversas';
COMMENT ON COLUMN lab_user_settings.memory_reference_history IS 'Permite referenciar histórico de conversas anteriores nas respostas';

