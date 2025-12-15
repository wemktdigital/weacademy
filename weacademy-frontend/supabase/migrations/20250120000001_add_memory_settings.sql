-- Adicionar campos de configuração de memória na tabela lab_user_settings
-- Permite ao usuário controlar o uso de memória no Laboratório de IA
-- NOTA: Esta migration depende da tabela lab_user_settings que é criada em 20251026110000_lab_user_settings.sql

DO $$
BEGIN
    -- Verificar se a tabela lab_user_settings existe antes de alterar
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_user_settings'
    ) THEN
        -- Adicionar colunas se a tabela existir
        ALTER TABLE lab_user_settings 
        ADD COLUMN IF NOT EXISTS memory_enabled BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS memory_auto_extract BOOLEAN DEFAULT true,
        ADD COLUMN IF NOT EXISTS memory_reference_history BOOLEAN DEFAULT false;

        -- Comentários para documentação
        COMMENT ON COLUMN lab_user_settings.memory_enabled IS 'Ativa ou desativa o uso de memória global em todas as conversas';
        COMMENT ON COLUMN lab_user_settings.memory_auto_extract IS 'Permite extração automática de memórias das conversas';
        COMMENT ON COLUMN lab_user_settings.memory_reference_history IS 'Permite referenciar histórico de conversas anteriores nas respostas';
        
        RAISE NOTICE '✅ Campos de memória adicionados à tabela lab_user_settings';
    ELSE
        RAISE NOTICE '⚠️ Tabela lab_user_settings não existe. Esta migration será ignorada. Execute 20251026110000_lab_user_settings.sql primeiro se usar lab-ia.';
    END IF;
END $$;

