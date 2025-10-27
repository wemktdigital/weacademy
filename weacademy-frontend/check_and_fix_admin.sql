-- Verificar e corrigir usuário admin
DO $$
DECLARE
    admin_user_id UUID;
    existing_id UUID;
BEGIN
    -- Verificar se o admin já existe
    SELECT id INTO existing_id FROM auth.users WHERE email = 'admin@weacademy.com';
    
    RAISE NOTICE 'Verificando usuário admin... existing_id: %', existing_id;
    
    IF existing_id IS NOT NULL THEN
        -- Atualizar senha do admin existente
        UPDATE auth.users 
        SET encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now()
        WHERE id = existing_id;
        
        -- Verificar se o perfil existe
        IF EXISTS (SELECT 1 FROM public.profiles WHERE id = existing_id) THEN
            -- Atualizar perfil existente
            UPDATE public.profiles
            SET role = 'admin',
                full_name = 'Administrador',
                updated_at = now()
            WHERE id = existing_id;
        ELSE
            -- Inserir perfil se não existir
            INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
            VALUES (existing_id, 'admin@weacademy.com', 'Administrador', 'admin', now(), now());
        END IF;
        
        RAISE NOTICE '✅ Admin existente atualizado: admin@weacademy.com / admin123';
    ELSE
        -- Criar novo admin
        admin_user_id := gen_random_uuid();
        
        RAISE NOTICE 'Criando novo admin com ID: %', admin_user_id;
        
        INSERT INTO auth.users (
            instance_id, id, aud, role, email, encrypted_password,
            email_confirmed_at, recovery_sent_at, last_sign_in_at,
            created_at, updated_at, confirmation_token, email_change,
            email_change_token_new, recovery_token
        ) VALUES (
            '00000000-0000-0000-0000-000000000000',
            admin_user_id,
            'authenticated',
            'authenticated',
            'admin@weacademy.com',
            crypt('admin123', gen_salt('bf')),
            now(), now(), now(), now(), now(), '', '', '', ''
        );
        
        INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
        VALUES (admin_user_id, 'admin@weacademy.com', 'Administrador', 'admin', now(), now());
        
        RAISE NOTICE '✅ Novo admin criado: admin@weacademy.com / admin123';
    END IF;
END $$;

-- Verificar resultado
SELECT 
    u.email,
    p.full_name,
    p.role,
    CASE 
        WHEN u.encrypted_password = crypt('admin123', u.encrypted_password) 
        THEN '✅ Senha correta' 
        ELSE '❌ Senha incorreta' 
    END as senha_status
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@weacademy.com';
