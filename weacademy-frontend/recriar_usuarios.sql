-- Recriar usuários de demonstração
-- Execute este SQL no Supabase Studio (SQL Editor)

-- Limpar dados existentes
DO $$
DECLARE
    user_id_var UUID;
BEGIN
    -- Limpar perfil de admin
    SELECT id INTO user_id_var FROM auth.users WHERE email = 'admin@weacademy.com';
    IF user_id_var IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = user_id_var;
        DELETE FROM auth.users WHERE id = user_id_var;
    END IF;
    
    -- Limpar perfil de user
    SELECT id INTO user_id_var FROM auth.users WHERE email = 'user@weacademy.com';
    IF user_id_var IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = user_id_var;
        DELETE FROM auth.users WHERE id = user_id_var;
    END IF;
    
    -- Limpar perfil de guest
    SELECT id INTO user_id_var FROM auth.users WHERE email = 'guest@weacademy.com';
    IF user_id_var IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = user_id_var;
        DELETE FROM auth.users WHERE id = user_id_var;
    END IF;
END $$;

-- Criar Admin
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Verificar se já existe
    SELECT id INTO admin_user_id FROM auth.users WHERE email = 'admin@weacademy.com';
    
    IF admin_user_id IS NULL THEN
        -- Criar novo
        admin_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            admin_user_id,
            'authenticated',
            'authenticated',
            'admin@weacademy.com',
            crypt('admin123', gen_salt('bf')),
            now(),
            now(),
            now()
        );
    ELSE
        -- Atualizar senha existente
        UPDATE auth.users SET encrypted_password = crypt('admin123', gen_salt('bf')) WHERE id = admin_user_id;
    END IF;
    
    -- Insert ou update profile
    INSERT INTO public.profiles (
        id, email, full_name, role, created_at, updated_at
    ) VALUES (
        admin_user_id,
        'admin@weacademy.com',
        'Admin WE Academy',
        'admin',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now();
    
    RAISE NOTICE '✅ Admin criado/atualizado: admin@weacademy.com / admin123';
END $$;

-- Criar User
DO $$
DECLARE
    user_user_id UUID;
BEGIN
    SELECT id INTO user_user_id FROM auth.users WHERE email = 'user@weacademy.com';
    
    IF user_user_id IS NULL THEN
        user_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            user_user_id,
            'authenticated',
            'authenticated',
            'user@weacademy.com',
            crypt('user123', gen_salt('bf')),
            now(),
            now(),
            now()
        );
    ELSE
        UPDATE auth.users SET encrypted_password = crypt('user123', gen_salt('bf')) WHERE id = user_user_id;
    END IF;
    
    INSERT INTO public.profiles (
        id, email, full_name, role, created_at, updated_at
    ) VALUES (
        user_user_id,
        'user@weacademy.com',
        'User WE Academy',
        'user',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now();
    
    RAISE NOTICE '✅ User criado/atualizado: user@weacademy.com / user123';
END $$;

-- Criar Guest
DO $$
DECLARE
    guest_user_id UUID;
BEGIN
    SELECT id INTO guest_user_id FROM auth.users WHERE email = 'guest@weacademy.com';
    
    IF guest_user_id IS NULL THEN
        guest_user_id := gen_random_uuid();
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, created_at, updated_at
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            guest_user_id,
            'authenticated',
            'authenticated',
            'guest@weacademy.com',
            crypt('guest123', gen_salt('bf')),
            now(),
            now(),
            now()
        );
    ELSE
        UPDATE auth.users SET encrypted_password = crypt('guest123', gen_salt('bf')) WHERE id = guest_user_id;
    END IF;
    
    INSERT INTO public.profiles (
        id, email, full_name, role, created_at, updated_at
    ) VALUES (
        guest_user_id,
        'guest@weacademy.com',
        'Guest WE Academy',
        'guest',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET 
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now();
    
    RAISE NOTICE '✅ Guest criado/atualizado: guest@weacademy.com / guest123';
END $$;
