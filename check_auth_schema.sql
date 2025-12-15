-- Verificar schema do Supabase Auth
-- Este script verifica se as tabelas e estruturas necessárias do auth existem

-- 1. Verificar tabelas do schema auth
SELECT 
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_schema = 'auth'
ORDER BY table_name;

-- 2. Verificar se existe tabela de configuração
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns
WHERE table_schema = 'auth' 
    AND (table_name LIKE '%config%' OR table_name LIKE '%setting%')
ORDER BY table_name, ordinal_position;

-- 3. Verificar tabela auth.instances (usada para configurações)
SELECT EXISTS (
    SELECT 1 
    FROM information_schema.tables 
    WHERE table_schema = 'auth' 
    AND table_name = 'instances'
) as has_instances_table;

-- 4. Se a tabela instances existir, verificar sua estrutura
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' 
    AND table_name = 'instances'
ORDER BY ordinal_position;

-- 5. Verificar se há configurações salvas
SELECT * FROM auth.instances LIMIT 1;

-- 6. Verificar funções do auth que podem estar faltando
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines
WHERE routine_schema = 'auth'
    AND routine_name LIKE '%config%'
ORDER BY routine_name;

-- 7. Verificar extensões habilitadas relacionadas ao auth
SELECT 
    extname,
    extversion
FROM pg_extension
WHERE extname LIKE '%auth%' OR extname LIKE '%pg%crypto%' OR extname LIKE '%uuid%'
ORDER BY extname;

-- 8. Verificar se há erros recentes no log (se tiver acesso)
-- Nota: Isso pode não funcionar dependendo das permissões
SELECT * FROM pg_stat_statements 
WHERE query LIKE '%auth%config%' 
ORDER BY total_time DESC 
LIMIT 5;
