-- Verificação específica da tabela auth.instances
-- Esta tabela é CRUCIAL - é onde o Supabase Auth salva as configurações

-- 1. Verificar se a tabela auth.instances existe
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'auth' AND table_name = 'instances'
        ) THEN '✅ Tabela auth.instances EXISTE'
        ELSE '❌ Tabela auth.instances NÃO EXISTE - Migrations do Auth não foram executadas!'
    END as status;

-- 2. Se existir, verificar estrutura
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'auth' 
    AND table_name = 'instances'
ORDER BY ordinal_position;

-- 3. Se existir, verificar conteúdo (configurações salvas)
SELECT 
    id,
    uuid,
    raw_base_config,
    created_at,
    updated_at
FROM auth.instances
LIMIT 5;

-- 4. Verificar todas as tabelas do schema auth
SELECT 
    table_name,
    CASE 
        WHEN table_name = 'instances' THEN '⚠️ CRÍTICA para configurações'
        WHEN table_name = 'users' THEN '✅ Essencial'
        ELSE 'Info'
    END as importancia
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY 
    CASE WHEN table_name = 'instances' THEN 0 ELSE 1 END,
    table_name;

-- 5. Verificar se há erros de permissão ou schema
-- Verificar se o usuário postgres tem acesso ao schema auth
SELECT 
    has_schema_privilege('postgres', 'auth', 'USAGE') as can_use_auth_schema,
    has_schema_privilege('postgres', 'auth', 'CREATE') as can_create_in_auth;
