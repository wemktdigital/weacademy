-- Criar usuário Admin diretamente
INSERT INTO auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
) 
SELECT 
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'admin@weacademy.com',
    crypt('admin123', gen_salt('bf')),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
WHERE NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@weacademy.com'
)
RETURNING id as user_id;

-- Criar perfil do admin
INSERT INTO public.profiles (id, email, full_name, role, created_at, updated_at)
SELECT 
    id,
    'admin@weacademy.com',
    'Admin WE Academy',
    'admin',
    now(),
    now()
FROM auth.users
WHERE email = 'admin@weacademy.com'
AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE email = 'admin@weacademy.com'
);

SELECT '✅ Admin criado com sucesso: admin@weacademy.com / admin123' as resultado;
