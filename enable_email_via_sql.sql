-- Habilitar Email Provider via SQL diretamente na tabela auth.instances
-- ATENÇÃO: Execute este script apenas se a interface web não funcionar

-- 1. Primeiro, verificar o conteúdo atual
SELECT 
    id,
    raw_base_config::text as current_config
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 2. Verificar se email está desabilitado
SELECT 
    CASE 
        WHEN raw_base_config->'external'->'email'->>'enabled' = 'false' 
            THEN '❌ Email está DESABILITADO'
        WHEN raw_base_config->'external'->'email'->>'enabled' = 'true' 
            THEN '✅ Email está HABILITADO'
        ELSE '⚠️ Configuração de email não encontrada ou formato diferente'
    END as email_status,
    raw_base_config->'external'->'email' as email_config
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 3. Habilitar email provider
-- ATENÇÃO: Isso pode não funcionar dependendo da versão do Supabase
-- O formato do JSON pode variar
DO $$
DECLARE
    instance_record RECORD;
    current_config JSONB;
    new_config JSONB;
BEGIN
    -- Buscar o registro de instância
    SELECT id, raw_base_config INTO instance_record
    FROM auth.instances
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF instance_record.id IS NULL THEN
        RAISE EXCEPTION 'Nenhuma instância encontrada';
    END IF;
    
    -- Converter para JSONB se for text
    IF pg_typeof(instance_record.raw_base_config) = 'text'::regtype THEN
        current_config := instance_record.raw_base_config::jsonb;
    ELSE
        current_config := instance_record.raw_base_config;
    END IF;
    
    -- Garantir que a estrutura external existe
    IF current_config->'external' IS NULL THEN
        current_config := jsonb_set(current_config, '{external}', '{}'::jsonb);
    END IF;
    
    -- Garantir que a estrutura email existe
    IF current_config->'external'->'email' IS NULL THEN
        current_config := jsonb_set(current_config, '{external,email}', '{}'::jsonb);
    END IF;
    
    -- Habilitar email
    current_config := jsonb_set(
        current_config, 
        '{external,email,enabled}', 
        'true'::jsonb
    );
    
    -- Atualizar no banco
    UPDATE auth.instances
    SET raw_base_config = current_config::text,
        updated_at = NOW()
    WHERE id = instance_record.id;
    
    RAISE NOTICE '✅ Email provider habilitado! ID: %', instance_record.id;
END $$;

-- 4. Verificar se foi atualizado
SELECT 
    id,
    raw_base_config->'external'->'email'->>'enabled' as email_enabled,
    updated_at
FROM auth.instances
ORDER BY updated_at DESC
LIMIT 1;
