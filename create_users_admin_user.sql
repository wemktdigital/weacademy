-- Criar usuários Admin e User para WE Academy
-- Admin: admin@weacademy.com / admin123
-- Usuário: user@weacademy.com / user123
--
-- Este script pode ser executado no SQL Editor do Supabase
-- Ele verifica se a tabela profiles existe, cria se necessário, e depois cria os usuários

-- Garantir que as extensões necessárias estão habilitadas
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- CRIAR TABELA PROFILES SE NÃO EXISTIR
-- ========================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user', 'guest')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at 
    BEFORE UPDATE ON public.profiles 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Habilitar RLS na tabela profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Criar políticas básicas de RLS (usuários podem ver e atualizar seus próprios perfis)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
    FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

DO $$
DECLARE
    admin_user_id UUID;
    user_user_id UUID;
BEGIN
    -- ========================================
    -- CRIAR USUÁRIO ADMIN
    -- ========================================
    
    -- Verificar se admin já existe
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@weacademy.com';
    
    IF admin_user_id IS NULL THEN
        -- Criar novo usuário admin
        admin_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            admin_user_id,
            'authenticated',
            'authenticated',
            'admin@weacademy.com',
            crypt('admin123', gen_salt('bf')),
            now(),
            now(),
            now(),
            now(),
            now(),
            '',
            '',
            '',
            ''
        );
        
        RAISE NOTICE '✅ Usuário ADMIN criado: admin@weacademy.com / admin123';
    ELSE
        -- Atualizar senha se o usuário já existir
        UPDATE auth.users 
        SET encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now()
        WHERE id = admin_user_id;
        
        RAISE NOTICE '🔄 Usuário ADMIN já existe. Senha atualizada: admin@weacademy.com / admin123';
    END IF;
    
    -- Criar ou atualizar perfil do admin
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        admin_user_id,
        'admin@weacademy.com',
        'Administrador WE Academy',
        'admin',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = 'admin',
        updated_at = now();
    
    -- ========================================
    -- CRIAR USUÁRIO USER
    -- ========================================
    
    -- Verificar se user já existe
    SELECT id INTO user_user_id FROM auth.users WHERE email = 'user@weacademy.com';
    
    IF user_user_id IS NULL THEN
        -- Criar novo usuário
        user_user_id := gen_random_uuid();
        
        INSERT INTO auth.users (
            instance_id,
            id,
            aud,
            role,
            email,
            encrypted_password,
            email_confirmed_at,
            recovery_sent_at,
            last_sign_in_at,
            created_at,
            updated_at,
            confirmation_token,
            email_change,
            email_change_token_new,
            recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            user_user_id,
            'authenticated',
            'authenticated',
            'user@weacademy.com',
            crypt('user123', gen_salt('bf')),
            now(),
            now(),
            now(),
            now(),
            now(),
            '',
            '',
            '',
            ''
        );
        
        RAISE NOTICE '✅ Usuário USER criado: user@weacademy.com / user123';
    ELSE
        -- Atualizar senha se o usuário já existir
        UPDATE auth.users 
        SET encrypted_password = crypt('user123', gen_salt('bf')),
            updated_at = now()
        WHERE id = user_user_id;
        
        RAISE NOTICE '🔄 Usuário USER já existe. Senha atualizada: user@weacademy.com / user123';
    END IF;
    
    -- Criar ou atualizar perfil do user
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        user_user_id,
        'user@weacademy.com',
        'Usuário WE Academy',
        'user',
        now(),
        now()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = 'user',
        updated_at = now();
    
    RAISE NOTICE '✨ Processo concluído! Usuários prontos para uso.';
    
END $$;

-- Verificar se os usuários foram criados corretamente
SELECT 
    u.email,
    p.full_name,
    p.role,
    u.created_at,
    CASE 
        WHEN u.id IS NOT NULL THEN '✅ Criado'
        ELSE '❌ Erro'
    END as status
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email IN ('admin@weacademy.com', 'user@weacademy.com')
ORDER BY u.email;
