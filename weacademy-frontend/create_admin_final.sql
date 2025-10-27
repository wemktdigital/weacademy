-- CRIAR USUÁRIO ADMIN MANUALMENTE
-- Email: admin@weacademy.com
-- Senha: admin123

-- Passo 1: Inserir na tabela auth.users
-- Copie um UUID (exemplo abaixo) ou gere um novo
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
    gen_random_uuid(),  -- Gera um UUID único automaticamente
    'authenticated',
    'authenticated',
    'admin@weacademy.com',
    crypt('admin123', gen_salt('bf')),  -- Criptografa a senha
    now(),
    now(),
    now(),
    now(),
    now(),
    '',
    '',
    '',
    ''
) RETURNING id;  -- Retorna o ID para usar no próximo passo

-- Passo 2: Copie o ID retornado acima e use aqui
-- Exemplo: se o ID retornado foi '12345678-1234-1234-1234-123456789abc'
-- Substitua 'SEU_ID_AQUI' pelo ID real

INSERT INTO public.profiles (
    id,
    email,
    full_name,
    role,
    created_at,
    updated_at
) VALUES (
    'SEU_ID_AQUI',  -- COLE O ID RETORNADO DO PASSO 1 AQUI
    'admin@weacademy.com',
    'Administrador',
    'admin',
    now(),
    now()
);

-- Passo 3: Verificar se foi criado corretamente
SELECT 
    u.email,
    p.full_name,
    p.role,
    '✅ Usuário criado com sucesso!' as status
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@weacademy.com';
