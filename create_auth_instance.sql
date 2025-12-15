-- Criar registro de instância no auth.instances se não existir
-- Esta é a configuração inicial necessária para o Supabase Auth funcionar

-- 1. Verificar se já existe alguma instância
SELECT COUNT(*) as total_instances FROM auth.instances;

-- 2. Criar instância com configuração básica se não existir
DO $$
DECLARE
    instance_id_val UUID;
    instance_uuid_val UUID;
    base_config JSONB;
BEGIN
    -- Verificar se já existe
    SELECT id INTO instance_id_val FROM auth.instances LIMIT 1;
    
    IF instance_id_val IS NOT NULL THEN
        RAISE NOTICE '✅ Instância já existe. ID: %', instance_id_val;
    ELSE
        -- Gerar UUIDs
        instance_id_val := gen_random_uuid();
        instance_uuid_val := gen_random_uuid();
        
        -- Criar configuração base do Supabase Auth
        -- Estrutura padrão com email habilitado
        base_config := jsonb_build_object(
            'external', jsonb_build_object(
                'email', jsonb_build_object(
                    'enabled', true,
                    'signup_enabled', true,
                    'double_confirm_changes', true,
                    'enable_confirmations', false
                )
            ),
            'site_url', 'http://localhost:3000',
            'additional_redirect_urls', jsonb_build_array('http://localhost:3000/**'),
            'jwt_expiry', 3600,
            'enable_signup', true,
            'enable_anonymous_sign_ins', false
        );
        
        -- Inserir nova instância
        INSERT INTO auth.instances (
            id,
            uuid,
            raw_base_config,
            created_at,
            updated_at
        ) VALUES (
            instance_id_val,
            instance_uuid_val,
            base_config::text,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ Instância criada com sucesso!';
        RAISE NOTICE 'ID: %', instance_id_val;
        RAISE NOTICE 'Email provider: HABILITADO';
    END IF;
END $$;

-- 3. Verificar a instância criada
SELECT 
    id,
    uuid,
    raw_base_config::jsonb->'external'->'email'->>'enabled' as email_enabled,
    raw_base_config::jsonb->'external'->'email' as email_config,
    created_at,
    updated_at
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 4. Mostrar configuração completa (formatada)
SELECT 
    id,
    jsonb_pretty(raw_base_config::jsonb) as config_pretty
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;
