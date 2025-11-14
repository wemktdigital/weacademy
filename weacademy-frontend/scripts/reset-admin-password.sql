-- Resetar senha do usuário admin existente para: admin123
-- Email: admin@weacademy.com
-- Nova Senha: admin123

-- Atualizar senha do usuário admin
UPDATE auth.users
SET 
    encrypted_password = crypt('admin123', gen_salt('bf')),
    updated_at = now()
WHERE email = 'admin@weacademy.com';

-- Verificar se o usuário existe e foi atualizado
DO $$
DECLARE
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count
    FROM auth.users
    WHERE email = 'admin@weacademy.com';
    
    IF user_count = 0 THEN
        RAISE NOTICE '⚠️ Usuário admin@weacademy.com não encontrado!';
        RAISE NOTICE 'Execute o script criar-admin-simples.sql primeiro.';
    ELSE
        RAISE NOTICE '✅ Senha do usuário admin resetada com sucesso!';
        RAISE NOTICE '📧 Email: admin@weacademy.com';
        RAISE NOTICE '🔑 Nova Senha: admin123';
    END IF;
END $$;

