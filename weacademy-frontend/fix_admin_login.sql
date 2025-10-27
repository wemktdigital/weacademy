-- Corrigir senha do usuário admin
-- Email: admin@weacademy.com
-- Senha: admin123 (sem maiúscula)

DO $$
DECLARE
    user_id_val UUID;
BEGIN
    -- Buscar ID do usuário admin
    SELECT id INTO user_id_val FROM auth.users WHERE email = 'admin@weacademy.com';
    
    IF user_id_val IS NULL THEN
        -- Criar usuário se não existir
        user_id_val := gen_random_uuid();
        
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
            user_id_val,
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
        
        RAISE NOTICE 'Usuário admin criado: %', user_id_val;
    ELSE
        -- Atualizar senha se já existir
        UPDATE auth.users 
        SET encrypted_password = crypt('admin123', gen_salt('bf')),
            updated_at = now()
        WHERE id = user_id_val;
        
        RAISE NOTICE 'Senha do admin atualizada: %', user_id_val;
    END IF;
    
    -- Garantir que existe perfil
    INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
    VALUES (user_id_val, 'admin@weacademy.com', 'Administrador', 'admin', now(), now())
    ON CONFLICT (id) DO UPDATE 
    SET role = 'admin',
        updated_at = now();
    
    RAISE NOTICE 'Perfil admin configurado com sucesso!';
END $$;

-- Verificar
SELECT 
    u.id,
    u.email,
    u.email_confirmed_at IS NOT NULL as confirmed,
    p.role,
    p.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@weacademy.com';
