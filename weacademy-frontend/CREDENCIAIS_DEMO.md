# Credenciais de Demonstração - WE Academy

## 👥 Usuários de Demonstração

### 🔴 Administrador
- **Email:** `admin@weacademy.com`
- **Senha:** `admin123`
- **Permissões:** Acesso total ao sistema, incluindo:
  - Dashboard administrativo
  - Gestão de usuários
  - Visualização de logs de auditoria
  - Analytics e relatórios
  - Todas as funcionalidades administrativas

### 🔵 Usuário Padrão
- **Email:** `user@weacademy.com`
- **Senha:** `user123`
- **Permissões:** Acesso padrão ao sistema
  - Visualização de cursos
  - Inscrições em cursos
  - Perfil e configurações
  - Sem acesso administrativo

### 🟢 Convidado
- **Email:** `guest@weacademy.com`
- **Senha:** `guest123`
- **Permissões:** Acesso limitado
  - Visualização de conteúdo público
  - Sem acesso a recursos premium

---

## 🚀 Como Criar os Usuários

### Opção 1: Via Supabase Studio (Recomendado)

1. Acesse o Supabase Studio: http://localhost:54323
2. Vá para **SQL Editor**
3. Copie e cole o conteúdo do arquivo `create_demo_users.sql`
4. Clique em **Run**
5. Verifique se os usuários foram criados em **Table Editor** > **auth.users** e **public.profiles**

### Opção 2: Via Terminal (se tiver `psql` instalado)

```bash
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres < weacademy-frontend/create_demo_users.sql
```

### Opção 3: Criar Manualmente no Aplicativo

1. Acesse a aplicação: http://localhost:3000
2. Clique em **Cadastrar** em `/auth/register`
3. Registre cada usuário com os emails acima
4. Depois, no Supabase Studio SQL Editor, execute:

```sql
-- Definir role de admin
UPDATE public.profiles 
SET role = 'admin' 
WHERE email = 'admin@weacademy.com';

-- Definir role de user
UPDATE public.profiles 
SET role = 'user' 
WHERE email = 'user@weacademy.com';

-- Definir role de guest
UPDATE public.profiles 
SET role = 'guest' 
WHERE email = 'guest@weacademy.com';
```

---

## 📋 Estrutura de Permissões

### Admin (`role = 'admin'`)
- ✅ Acesso a `/admin` (Dashboard administrativo)
- ✅ Acesso a `/admin/audit-logs` (Logs de auditoria)
- ✅ Acesso a `/admin/analytics` (Analytics)
- ✅ Link "Admin" visível no menu de navegação
- ✅ Badge "Administrador" no perfil

### User (`role = 'user'`)
- ❌ Acesso negado a `/admin` → redireciona para `/access-denied`
- ✅ Acesso a todas as páginas de usuário
- ✅ Badge "Usuário" no perfil
- ❌ Link "Admin" não aparece no menu

### Guest (`role = 'guest'`)
- ❌ Acesso negado a `/admin` → redireciona para `/access-denied`
- ✅ Acesso limitado ao conteúdo público
- ✅ Badge "Convidado" no perfil
- ❌ Link "Admin" não aparece no menu

---

## 🔒 Segurança

⚠️ **Importante:** Estas credenciais são apenas para ambiente de desenvolvimento local. NÃO use senhas tão simples em produção!

Em produção, utilize senhas fortes e únicas para cada usuário administrativo.

---

## ✅ Verificação

Após criar os usuários, você pode:

1. Testar login com cada credencial
2. Verificar que o admin tem acesso ao `/admin`
3. Confirmar que usuários não-admin recebem erro 403 ao acessar `/admin`
4. Verificar os badges de role no dropdown do usuário (canto superior direito)

---

**Criado para WE Academy by WE Marketing Médico** 🏥
