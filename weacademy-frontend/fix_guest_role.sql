-- Corrigir role do guest para 'guest'
UPDATE public.profiles 
SET role = 'guest' 
WHERE email = 'guest@weacademy.com';

-- Verificar se foi alterado
SELECT email, full_name, role 
FROM public.profiles 
ORDER BY email;
