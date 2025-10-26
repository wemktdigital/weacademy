-- Criar usuário Admin
DO $$
DECLARE
    admin_user_id UUID := gen_random_uuid();
BEGIN
    -- Deletar se já existe
    DELETE FROM public.profiles WHERE email = 'admin@weacademy.com';
    DELETE FROM auth.users WHERE email = 'admin@weacademy.com';
    
    -- Criar em auth.users
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
    
    -- Criar em profiles
    INSERT INTO public.profiles (
        id, email, full_name, role, created_at, updated_at
    ) VALUES (
        admin_user_id,
        'admin@weacademy.com',
        'Admin WE Academy',
        'admin',
        now(),
        now()
    );
    
    RAISE NOTICE '✅ Admin criado: admin@weacademy.com / admin123';
END $$;
