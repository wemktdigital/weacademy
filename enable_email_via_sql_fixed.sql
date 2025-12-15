-- Habilitar Email Provider via SQL (versão corrigida para TEXT)
-- raw_base_config é TEXT, precisa fazer cast para JSONB

-- 1. Primeiro, ver o conteúdo atual (texto completo)
SELECT 
    id,
    raw_base_config as current_config
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 2. Ver estrutura do JSON (se conseguir converter)
SELECT 
    id,
    raw_base_config::jsonb as config_as_jsonb,
    raw_base_config::jsonb->'external' as external_config
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 3. Tentar habilitar email provider
DO $$
DECLARE
    instance_id_val UUID;
    current_config_text TEXT;
    current_config_jsonb JSONB;
    new_config_jsonb JSONB;
BEGIN
    -- Buscar o registro de instância
    SELECT id, raw_base_config INTO instance_id_val, current_config_text
    FROM auth.instances
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF instance_id_val IS NULL THEN
        RAISE EXCEPTION 'Nenhuma instância encontrada';
    END IF;
    
    -- Converter TEXT para JSONB
    BEGIN
        current_config_jsonb := current_config_text::jsonb;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Erro ao converter JSON: %', SQLERRM;
    END;
    
    -- Copiar configuração atual
    new_config_jsonb := current_config_jsonb;
    
    -- Garantir que a estrutura external existe
    IF new_config_jsonb->'external' IS NULL THEN
        new_config_jsonb := jsonb_set(new_config_jsonb, '{external}', '{}'::jsonb);
    END IF;
    
    -- Garantir que a estrutura email existe dentro de external
    IF new_config_jsonb->'external'->'email' IS NULL THEN
        new_config_jsonb := jsonb_set(new_config_jsonb, '{external,email}', '{}'::jsonb);
    END IF;
    
    -- Habilitar email (definir enabled = true)
    new_config_jsonb := jsonb_set(
        new_config_jsonb, 
        '{external,email,enabled}', 
        'true'::jsonb,
        true  -- create_missing = true
    );
    
    -- Atualizar no banco (converter JSONB de volta para TEXT)
    UPDATE auth.instances
    SET raw_base_config = new_config_jsonb::text,
        updated_at = NOW()
    WHERE id = instance_id_val;
    
    RAISE NOTICE '✅ Email provider habilitado! ID: %, Config atualizado', instance_id_val;
    RAISE NOTICE 'Nova configuração email: %', new_config_jsonb->'external'->'email';
END $$;

-- 4. Verificar se foi atualizado
SELECT 
    id,
    raw_base_config::jsonb->'external'->'email'->>'enabled' as email_enabled,
    raw_base_config::jsonb->'external'->'email' as email_full_config,
    updated_at
FROM auth.instances
ORDER BY updated_at DESC
LIMIT 1;
