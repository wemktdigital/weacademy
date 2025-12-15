-- Script para adicionar foreign keys à tabela lab_video_operations
-- Execute este script DEPOIS de aplicar 20251026105808_lab_ia_schema.sql

-- Adicionar foreign key para conversation_id se ainda não existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_conversations'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_video_operations'
    ) THEN
        -- Verificar se a constraint já existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'lab_video_operations_conversation_id_fkey'
            AND table_name = 'lab_video_operations'
        ) THEN
            ALTER TABLE lab_video_operations
            ADD CONSTRAINT lab_video_operations_conversation_id_fkey
            FOREIGN KEY (conversation_id) REFERENCES lab_conversations(id) ON DELETE CASCADE;
            
            RAISE NOTICE '✅ Foreign key para lab_conversations adicionada';
        ELSE
            RAISE NOTICE '⚠️ Foreign key para lab_conversations já existe';
        END IF;
    END IF;

    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_messages'
    ) AND EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'lab_video_operations'
    ) THEN
        -- Verificar se a constraint já existe
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.table_constraints 
            WHERE constraint_name = 'lab_video_operations_message_id_fkey'
            AND table_name = 'lab_video_operations'
        ) THEN
            ALTER TABLE lab_video_operations
            ADD CONSTRAINT lab_video_operations_message_id_fkey
            FOREIGN KEY (message_id) REFERENCES lab_messages(id) ON DELETE CASCADE;
            
            RAISE NOTICE '✅ Foreign key para lab_messages adicionada';
        ELSE
            RAISE NOTICE '⚠️ Foreign key para lab_messages já existe';
        END IF;
    END IF;
END $$;
