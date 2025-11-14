-- Criar usuário admin com senha: admin123
-- Email: admin@weacademy.com
-- Senha: admin123

-- Deletar usuário existente se houver
DELETE FROM public.profiles WHERE email = 'admin@weacademy.com';
DELETE FROM auth.users WHERE email = 'admin@weacademy.com';

-- Criar novo usuário admin
DO $$
DECLARE
    new_user_id UUID;
BEGIN
    -- Gerar ID
    new_user_id := gen_random_uuid();
    
    -- Inserir na tabela auth.users
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
        new_user_id,
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
    
    -- Inserir na tabela public.profiles
    INSERT INTO public.profiles (
        id,
        email,
        full_name,
        role,
        created_at,
        updated_at
    ) VALUES (
        new_user_id,
        'admin@weacademy.com',
        'Administrador WE Academy',
        'admin',
        now(),
        now()
    );
    
    RAISE NOTICE '✅ Usuário admin criado com sucesso! ID: %', new_user_id;
    RAISE NOTICE '📧 Email: admin@weacademy.com';
    RAISE NOTICE '🔑 Senha: admin123';
END $$;

