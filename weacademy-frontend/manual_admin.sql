-- 1. PRIMEIRO: Ver quais usuários já existem
SELECT email, id FROM auth.users WHERE email LIKE '%weacademy%';

-- 2. Ver os perfis existentes
SELECT id, email, full_name, role FROM public.profiles;

-- 3. Se o admin JÁ EXISTE na tabela auth.users, apenas atualizar o role:
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@weacademy.com';

-- 4. Verificar resultado
SELECT 
    u.email,
    p.role,
    CASE WHEN p.role = 'admin' THEN '✅ É ADMIN' ELSE '❌ NÃO É ADMIN' END as status
FROM auth.users u
JOIN public.profiles p ON u.id = p.id
WHERE u.email = 'admin@weacademy.com';
