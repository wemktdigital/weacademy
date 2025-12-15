-- Verificar configurações na tabela auth.instances
-- Esta é a tabela onde o Supabase Auth salva as configurações dos providers

-- 1. Verificar estrutura da tabela instances
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' 
    AND table_name = 'instances'
ORDER BY ordinal_position;

-- 2. Verificar conteúdo atual (configurações salvas)
SELECT 
    id,
    uuid,
    raw_base_config,
    created_at,
    updated_at
FROM auth.instances
LIMIT 5;

-- 3. Verificar especificamente a configuração de email no JSON
-- Se raw_base_config for JSONB, podemos verificar diretamente
SELECT 
    id,
    raw_base_config->'external'->'email' as email_config,
    raw_base_config->'external'->'email'->>'enabled' as email_enabled
FROM auth.instances
LIMIT 5;

-- 4. Verificar se há registros na tabela
SELECT COUNT(*) as total_instances FROM auth.instances;

-- 5. Ver formato completo do raw_base_config (primeiro registro)
SELECT 
    raw_base_config
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;
