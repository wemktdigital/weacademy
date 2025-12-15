# 🚀 Migração para Supabase.com (Hospedado)

## 📋 Informações que precisamos

### 1. Você já tem um projeto no Supabase.com?

**Opção A: JÁ TEM PROJETO**
- Se sim, forneça:
  - URL do projeto (ex: `xxxxx.supabase.co`)
  - Anon Key
  - Service Role Key
  - Database URL (opcional, mas útil)

**Opção B: PRECISA CRIAR NOVO PROJETO**
- Se não, vamos criar um novo projeto juntos

---

## 🔑 Onde encontrar as credenciais no Supabase.com

1. Acesse: https://supabase.com/dashboard
2. Selecione seu projeto
3. Vá em **Settings** → **API**
4. Você encontrará:
   - **Project URL** (URL do projeto)
   - **anon/public key** (Anon Key)
   - **service_role key** (Service Role Key - mantenha secreto!)

---

## 📝 Checklist de Informações

Por favor, forneça:

- [ ] **Project URL**: `https://xxxxx.supabase.co`
- [ ] **Anon Key**: `eyJhbGc...`
- [ ] **Service Role Key**: `eyJhbGc...` (opcional, mas recomendado)
- [ ] **Database URL** (se tiver): `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
- [ ] **Password do banco** (se souber - senha do postgres)

---

## 🔄 O que vamos fazer

1. ✅ Atualizar arquivos `.env.example` e `.env.local`
2. ✅ Aplicar todas as migrations no novo banco
3. ✅ Criar os usuários (admin e user)
4. ✅ Configurar providers de autenticação
5. ✅ Testar login

---

## ⚠️ Importante

- O Supabase.com já vem com email provider habilitado por padrão
- Não precisaremos criar a tabela `auth.instances` manualmente
- As configurações de auth são feitas pela interface web (que funciona perfeitamente)

---

## 🎯 Próximos Passos

**Me forneça as informações acima e eu atualizo todas as configurações automaticamente!**

