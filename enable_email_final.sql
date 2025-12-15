-- Script FINAL para habilitar email provider
-- Este script funciona mesmo se a tabela auth.instances estiver vazia

-- 1. Verificar situação atual
SELECT 
    COUNT(*) as total_instances,
    CASE 
        WHEN COUNT(*) = 0 THEN '❌ Tabela está VAZIA - precisa criar instância'
        ELSE '✅ Já existe instância'
    END as status
FROM auth.instances;

-- 2. Criar ou atualizar instância com email habilitado
DO $$
DECLARE
    instance_id_val UUID;
    instance_uuid_val UUID;
    existing_config JSONB;
    new_config JSONB;
BEGIN
    -- Verificar se já existe instância
    SELECT id, uuid, raw_base_config::jsonb 
    INTO instance_id_val, instance_uuid_val, existing_config
    FROM auth.instances 
    LIMIT 1;
    
    IF instance_id_val IS NULL THEN
        -- CRIAR nova instância
        instance_id_val := gen_random_uuid();
        instance_uuid_val := gen_random_uuid();
        
        new_config := jsonb_build_object(
            'external', jsonb_build_object(
                'email', jsonb_build_object(
                    'enabled', true,
                    'signup_enabled', true
                )
            ),
            'site_url', 'http://localhost:3000',
            'additional_redirect_urls', jsonb_build_array('http://localhost:3000/**'),
            'jwt_expiry', 3600,
            'enable_signup', true
        );
        
        INSERT INTO auth.instances (
            id, uuid, raw_base_config, created_at, updated_at
        ) VALUES (
            instance_id_val, instance_uuid_val, new_config::text, NOW(), NOW()
        );
        
        RAISE NOTICE '✅ NOVA instância criada com email HABILITADO! ID: %', instance_id_val;
        
    ELSE
        -- ATUALIZAR instância existente
        new_config := existing_config;
        
        -- Garantir estrutura external.email
        IF new_config->'external' IS NULL THEN
            new_config := jsonb_set(new_config, '{external}', '{}'::jsonb);
        END IF;
        
        IF new_config->'external'->'email' IS NULL THEN
            new_config := jsonb_set(new_config, '{external,email}', '{}'::jsonb);
        END IF;
        
        -- Habilitar email
        new_config := jsonb_set(
            new_config, 
            '{external,email,enabled}', 
            'true'::jsonb,
            true
        );
        
        new_config := jsonb_set(
            new_config, 
            '{external,email,signup_enabled}', 
            'true'::jsonb,
            true
        );
        
        UPDATE auth.instances
        SET raw_base_config = new_config::text,
            updated_at = NOW()
        WHERE id = instance_id_val;
        
        RAISE NOTICE '✅ Instância ATUALIZADA com email HABILITADO! ID: %', instance_id_val;
    END IF;
END $$;

-- 3. Verificar resultado
SELECT 
    id,
    raw_base_config::jsonb->'external'->'email'->>'enabled' as email_enabled,
    raw_base_config::jsonb->'external'->'email'->>'signup_enabled' as signup_enabled,
    raw_base_config::jsonb->'site_url' as site_url,
    updated_at
FROM auth.instances
ORDER BY updated_at DESC
LIMIT 1;

-- 4. Mostrar configuração de email completa
SELECT 
    jsonb_pretty(raw_base_config::jsonb->'external'->'email') as email_config_pretty
FROM auth.instances
ORDER BY updated_at DESC
LIMIT 1;
