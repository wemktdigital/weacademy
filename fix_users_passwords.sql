-- Atualizar senhas dos usuários e garantir roles corretas

-- Atualizar senha do admin
UPDATE auth.users 
SET encrypted_password = crypt('admin123', gen_salt('bf'))
WHERE email = 'admin@weacademy.com';

-- Atualizar role do admin
UPDATE public.profiles 
SET role = 'admin'
WHERE email = 'admin@weacademy.com';

-- Atualizar senha do user
UPDATE auth.users 
SET encrypted_password = crypt('user123', gen_salt('bf'))
WHERE email = 'user@weacademy.com';

-- Atualizar role do user
UPDATE public.profiles 
SET role = 'user'
WHERE email = 'user@weacademy.com';

-- Atualizar senha do guest
UPDATE auth.users 
SET encrypted_password = crypt('guest123', gen_salt('bf'))
WHERE email = 'guest@weacademy.com';

-- Atualizar role do guest
UPDATE public.profiles 
SET role = 'guest'
WHERE email = 'guest@weacademy.com';

-- Verificar resultado
SELECT email, full_name, role FROM public.profiles 
WHERE email IN ('admin@weacademy.com', 'user@weacademy.com', 'guest@weacademy.com');
