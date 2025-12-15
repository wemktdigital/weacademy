# ✅ Setup Completo - Supabase.com

## 🎉 Configuração Finalizada

Todas as credenciais foram atualizadas nos arquivos `env.example`!

### ✅ Credenciais Configuradas

- **Project URL**: `https://ccasrjipfwijdnitcdkj.supabase.co`
- **Anon Key**: Configurada ✅
- **Service Role Key**: Configurada ✅
- **Database URL**: Configurada ✅

---

## 📋 Próximos Passos

### 1. Atualizar .env.local

```bash
cd weacademy-frontend
cp env.example .env.local
```

O arquivo `.env.local` já terá todas as credenciais corretas!

---

### 2. Aplicar Migrations no Banco

Acesse o SQL Editor do Supabase.com:
- URL: https://ccasrjipfwijdnitcdkj.supabase.co/project/default/sql

Execute o arquivo: `apply_essential_migrations.sql`

Isso criará todas as tabelas necessárias.

---

### 3. Criar Usuários

Após aplicar as migrations, execute no SQL Editor:
- Arquivo: `create_users_admin_user.sql`

Isso criará:
- Admin: `admin@weacademy.com` / `admin123`
- User: `user@weacademy.com` / `user123`

---

### 4. Configurar Redirect URLs

No Supabase.com:
1. Vá em **Authentication** → **URL Configuration**
2. Em **Site URL**: `http://localhost:3000`
3. Em **Redirect URLs**, adicione: `http://localhost:3000/**`

⚠️ **Importante**: O email provider já vem habilitado por padrão no Supabase.com!

---

### 5. Reiniciar Servidor e Testar

```bash
cd weacademy-frontend
npm run dev
```

Teste o login:
- Email: `admin@weacademy.com`
- Senha: `admin123`

---

## ✅ Checklist

- [x] Credenciais atualizadas nos arquivos env.example
- [ ] Criar/atualizar .env.local
- [ ] Aplicar migrations no banco
- [ ] Criar usuários
- [ ] Configurar redirect URLs
- [ ] Testar login

---

## 🚀 Tudo pronto!

Siga os passos acima e a aplicação estará funcionando com o Supabase.com hospedado!

