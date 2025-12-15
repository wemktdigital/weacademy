-- Verificar configurações na tabela auth.instances (versão corrigida)
-- raw_base_config é TEXT, precisa fazer cast para JSONB

-- 1. Verificar estrutura da tabela
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' 
    AND table_name = 'instances'
ORDER BY ordinal_position;

-- 2. Ver conteúdo completo (formato TEXT)
SELECT 
    id,
    raw_base_config as current_config_text,
    LENGTH(raw_base_config) as config_length
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 3. Tentar converter para JSONB e verificar email (se for JSON válido)
SELECT 
    id,
    CASE 
        WHEN raw_base_config::jsonb->'external'->'email'->>'enabled' = 'false' 
            THEN '❌ Email está DESABILITADO'
        WHEN raw_base_config::jsonb->'external'->'email'->>'enabled' = 'true' 
            THEN '✅ Email está HABILITADO'
        ELSE '⚠️ Configuração não encontrada ou formato diferente'
    END as email_status,
    raw_base_config::jsonb->'external'->'email' as email_config
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 4. Ver todo o conteúdo do JSON (formatado)
SELECT 
    id,
    raw_base_config::jsonb as config_json
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;

-- 5. Ver se há algum campo relacionado a email no JSON
SELECT 
    id,
    jsonb_object_keys(raw_base_config::jsonb) as top_level_keys
FROM auth.instances
LIMIT 1;
