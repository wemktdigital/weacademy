-- Criar usuários de demonstração para WE Academy
-- Admin: admin@weacademy.com / admin123
-- Usuário: user@weacademy.com / user123
-- Convidado: guest@weacademy.com / guest123

DO $$
DECLARE
    admin_user_id UUID;
    user_user_id UUID;
    guest_user_id UUID;
BEGIN
    -- Criar usuário Admin
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
    );
    
    RAISE NOTICE '✅ Usuário ADMIN criado: admin@weacademy.com / admin123';
    
    -- Criar usuário User
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
    );
    
    RAISE NOTICE '✅ Usuário USER criado: user@weacademy.com / user123';
    
    -- Criar usuário Guest
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
    );
    
    RAISE NOTICE '✅ Usuário GUEST criado: guest@weacademy.com / guest123';
    
END $$;
