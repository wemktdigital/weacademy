#!/bin/bash

echo "🔧 Criando usuários de demonstração..."

# Copiar SQL para área temporária
cat > /tmp/create_users.sql << 'EOF'
-- Criar usuários de demonstração
DO $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Criar usuário Admin
    admin_user_id := gen_random_uuid();
    
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
    
    RAISE NOTICE '✅ Admin criado: admin@weacademy.com / admin123';
END $$;
EOF

echo "✅ SQL criado em /tmp/create_users.sql"
echo ""
echo "📋 Execute isso no Supabase Studio (http://127.0.0.1:54323):"
echo "1. Vá em 'SQL Editor'"
echo "2. Abra o arquivo /tmp/create_users.sql"
echo "3. Clique em 'Run'"
echo ""
echo "Ou copie este comando:"
echo ""
cat /tmp/create_users.sql
