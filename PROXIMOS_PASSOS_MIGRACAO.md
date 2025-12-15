# 🚀 Próximos Passos - Migração para Supabase.com

## ✅ Configuração Atualizada

Atualizei os arquivos `env.example` com as novas credenciais do Supabase.com.

## 📋 Próximos Passos

### 1. Obter Service Role Key (IMPORTANTE)

Você ainda precisa fornecer a **Service Role Key**:

1. Acesse: https://supabase.com/dashboard/project/ccasrjipfwijdnitcdkj
2. Vá em **Settings** → **API**
3. Procure por **Project API keys**
4. Copie a chave **service_role** (secret) - geralmente começa com `eyJhbG...`
5. Me forneça essa chave ou atualize no `.env.local`

**⚠️ Importante:** A Service Role Key tem acesso total ao banco - mantenha secreta!

---

### 2. Atualizar .env.local

Atualize o arquivo `.env.local` na pasta `weacademy-frontend`:

```bash
cd weacademy-frontend
cp env.example .env.local
# Depois edite .env.local e adicione a Service Role Key
```

---

### 3. Aplicar Migrations no Novo Banco

Precisamos executar todas as migrations no banco do Supabase.com:

1. Acesse o SQL Editor: https://ccasrjipfwijdnitcdkj.supabase.co/project/default/sql
2. Execute o arquivo: `apply_essential_migrations.sql`
3. Ou execute migrations individualmente conforme `EXECUTE_IN_SQL_EDITOR.md`

---

### 4. Criar Usuários

Após aplicar as migrations, execute:
- `create_users_admin_user.sql` no SQL Editor

---

### 5. Configurar Redirect URLs

No Supabase.com, o email provider já vem habilitado! Mas configure os redirects:

1. Acesse: **Authentication** → **URL Configuration**
2. Adicione em **Redirect URLs**: `http://localhost:3000/**`

---

### 6. Testar Login

- Email: `admin@weacademy.com`
- Senha: `admin123`

---

## 📝 Resumo do que foi feito

✅ Arquivos `env.example` atualizados com:
- Project URL: `https://ccasrjipfwijdnitcdkj.supabase.co`
- Anon Key: `sb_publishable_lv8Ng8N3x5fRzODB0zO1jA_hcZ1Cvb4`
- Database URL: Configurado com a senha fornecida

⏳ Pendente:
- Service Role Key (você precisa fornecer)
- Aplicar migrations no novo banco
- Criar usuários
- Configurar redirect URLs

---

## 🎯 Agora preciso

**Me forneça a Service Role Key** para completar a configuração!

Ou se preferir, posso orientá-lo a:
1. Aplicar as migrations diretamente
2. Criar os usuários
3. Configurar tudo passo a passo

Qual você prefere fazer primeiro?

