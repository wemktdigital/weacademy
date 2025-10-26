# 🔧 Solução: Problema de Login do Admin

## ❌ Problema

Ao tentar fazer login como admin com `admin@weacademy.com` / `admin123`, aparece o erro "Invalid login credentials".

## ✅ Solução Rápida

### Opção 1: Criar via Supabase Studio (Mais fácil)

1. Acesse o Supabase Studio: http://localhost:54323
2. Clique em **Table Editor** no menu lateral
3. Procure a tabela `auth.users` e clique nela
4. Clique no botão **Insert row**
5. Preencha apenas os seguintes campos:
   - **email**: `admin@weacademy.com`
   - **encrypted_password**: Deixe vazio (supabase vai gerar automaticamente)
   
6. Após salvar, vá para a tabela `public.profiles`
7. Clique em **Insert row** e preencha:
   - **id**: Copie o ID do usuário criado em auth.users
   - **email**: `admin@weacademy.com`
   - **full_name**: `Admin WE Academy`
   - **role**: `admin`

### Opção 2: Executar Script SQL

1. Acesse o Supabase Studio: http://localhost:54323
2. Vá em **SQL Editor**
3. Cole e execute o seguinte código:

```sql
-- Deletar usuários existentes se houver
DELETE FROM public.profiles WHERE email IN ('admin@weacademy.com', 'user@weacademy.com', 'guest@weacademy.com');
DELETE FROM auth.users WHERE email IN ('admin@weacademy.com', 'user@weacademy.com', 'guest@weacademy.com');

-- Criar usuário Admin
DO $$
DECLARE
    admin_user_id UUID := gen_random_uuid();
BEGIN
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
```

4. Clique em **Run** (botão no canto inferior direito)
5. Você verá a mensagem: "✅ Admin criado: admin@weacademy.com / admin123"

## 🧪 Testar Login

1. Acesse: http://localhost:3000/auth/login
2. Digite:
   - Email: `admin@weacademy.com`
   - Senha: `admin123`
3. Clique em **Entrar**

## ✅ Verificação

Após o login bem-sucedido, você deve:
- Ver seu nome no canto superior direito
- Clicar no avatar e ver "Administrador" no badge
- Ver o link "Admin" no menu de navegação
- Ter acesso a `/admin`, `/admin/analytics` e `/admin/audit-logs`

## 💡 Dica

Se ainda não funcionar, tente fazer logout e login novamente, ou limpar o cache do navegador (Cmd+Shift+R no Mac).
