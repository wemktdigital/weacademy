-- Criar usuários de demonstração
-- Admin: admin@weacademy.com / admin123
-- Usuário: user@weacademy.com / user123
-- Convidado: guest@weacademy.com / guest123

-- Limpar usuários existentes (se houver) - ORDEM IMPORTANTE: profiles primeiro, depois auth.users
DO $$
DECLARE
    user_ids UUID[];
BEGIN
    -- Coletar IDs dos usuários existentes
    SELECT ARRAY_AGG(id) INTO user_ids
    FROM auth.users
    WHERE email IN ('admin@weacademy.com', 'user@weacademy.com', 'guest@weacademy.com');
    
    -- Deletar profiles primeiro (por causa da foreign key)
    IF user_ids IS NOT NULL THEN
        DELETE FROM public.profiles WHERE id = ANY(user_ids);
        DELETE FROM auth.users WHERE id = ANY(user_ids);
        RAISE NOTICE '🗑️ Removidos % usuário(s) existente(s)', array_length(user_ids, 1);
    END IF;
END $$;

-- Criar usuários
DO $$
DECLARE
    admin_user_id UUID;
    user_user_id UUID;
    guest_user_id UUID;
BEGIN
    -- ============================================
    -- USUÁRIO ADMIN
    -- ============================================
    -- Verificar se admin já existe, se sim, usar o ID existente
    SELECT id INTO admin_user_id
    FROM auth.users
    WHERE email = 'admin@weacademy.com';
    
    IF admin_user_id IS NULL THEN
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
    ELSE
        -- Atualizar senha do admin existente
        UPDATE auth.users
        SET encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now(),
            email_confirmed_at = now()
        WHERE id = admin_user_id;
    END IF;
    
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
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now();
    
    RAISE NOTICE '✅ Admin criado: admin@weacademy.com / admin123';
    
    -- ============================================
    -- USUÁRIO NORMAL
    -- ============================================
    SELECT id INTO user_user_id
    FROM auth.users
    WHERE email = 'user@weacademy.com';
    
    IF user_user_id IS NULL THEN
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
    ELSE
        UPDATE auth.users
        SET encrypted_password = crypt('user123', gen_salt('bf')),
            updated_at = now(),
            email_confirmed_at = now()
        WHERE id = user_user_id;
    END IF;
    
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
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now();
    
    RAISE NOTICE '✅ Usuário criado: user@weacademy.com / user123';
    
    -- ============================================
    -- USUÁRIO CONVIDADO
    -- ============================================
    SELECT id INTO guest_user_id
    FROM auth.users
    WHERE email = 'guest@weacademy.com';
    
    IF guest_user_id IS NULL THEN
        guest_user_id := gen_random_uuid();
        
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
            guest_user_id,
            'authenticated',
            'authenticated',
            'guest@weacademy.com',
            crypt('guest123', gen_salt('bf')),
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
    ELSE
        UPDATE auth.users
        SET encrypted_password = crypt('guest123', gen_salt('bf')),
            updated_at = now(),
            email_confirmed_at = now()
        WHERE id = guest_user_id;
    END IF;
    
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        guest_user_id,
        'guest@weacademy.com',
        'Convidado WE Academy',
        'guest',
        now(),
        now()
    ) ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        role = EXCLUDED.role,
        updated_at = now();
    
    RAISE NOTICE '✅ Convidado criado: guest@weacademy.com / guest123';
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 Todos os usuários foram criados com sucesso!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 Credenciais:';
    RAISE NOTICE '   👤 Admin: admin@weacademy.com / admin123';
    RAISE NOTICE '   👤 Usuário: user@weacademy.com / user123';
    RAISE NOTICE '   👤 Convidado: guest@weacademy.com / guest123';
END $$;

-- Verificar usuários criados
SELECT 
    u.email,
    p.full_name,
    p.role,
    u.email_confirmed_at IS NOT NULL as email_confirmado,
    '✅ Criado' as status
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE u.email IN ('admin@weacademy.com', 'user@weacademy.com', 'guest@weacademy.com')
ORDER BY p.role DESC, u.email;

