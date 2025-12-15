-- Script para verificar e habilitar email provider no Supabase
-- Execute este script no SQL Editor do Supabase

-- 1. Verificar configuração atual de auth
-- Nota: Em Supabase, as configurações de auth geralmente estão em auth.config ou via API
-- Vamos verificar se conseguimos acessar essas configurações

-- Verificar se há tabela de configuração
SELECT 
    table_name 
FROM information_schema.tables 
WHERE table_schema = 'auth' 
    AND table_name LIKE '%config%';

-- Verificar usuários criados via email
SELECT 
    email,
    created_at,
    confirmed_at IS NOT NULL as is_confirmed
FROM auth.users
WHERE email IS NOT NULL
ORDER BY created_at DESC;

-- IMPORTANTE: 
-- Em Supabase auto-hospedado, o email provider geralmente já está habilitado por padrão.
-- O erro na interface pode ser devido a:
-- 1. Problema na API de configuração
-- 2. Redirect URLs não configuradas
-- 3. Permissões

-- Se o email provider realmente estiver desabilitado, você pode precisar:
-- 1. Verificar o arquivo de configuração do Supabase (config.toml no servidor)
-- 2. Ou tentar fazer login mesmo assim - pode funcionar mesmo com a interface dando erro

-- Verificar se há alguma restrição na tabela auth.users
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'auth' 
    AND table_name = 'users'
ORDER BY ordinal_position;
