# ✅ Checklist - Migração para Supabase.com

## Passo 1: Acesso ao Supabase.com

- [ ] Tenho conta no Supabase.com
- [ ] Já tenho um projeto criado
- [ ] Tenho acesso ao dashboard do projeto

## Passo 2: Obter Credenciais

Vá em: **Settings** → **API** no dashboard do Supabase

- [ ] **Project URL**: 
  - Exemplo: `https://abcdefghijklmnop.supabase.co`
  - Onde encontro: Settings → API → Project URL

- [ ] **Anon/Public Key**: 
  - Começa com: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Onde encontro: Settings → API → Project API keys → anon public

- [ ] **Service Role Key**: 
  - Começa com: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
  - Onde encontro: Settings → API → Project API keys → service_role (secret)
  - ⚠️ Mantenha secreto!

## Passo 3: Database URL (Opcional)

Vá em: **Settings** → **Database**

- [ ] **Database URL**: 
  - Formato: `postgresql://postgres.[ref]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`
  - Ou: `postgresql://postgres:[PASSWORD]@db.xxxxx.supabase.co:5432/postgres`
  - Onde encontro: Settings → Database → Connection string → URI

- [ ] **Database Password**:
  - Senha do usuário postgres
  - Onde encontro: Settings → Database → Database password (ou Reset password se não souber)

---

## 📝 Após coletar as informações

Forneça:
1. Project URL
2. Anon Key  
3. Service Role Key (opcional mas recomendado)
4. Database URL (opcional)
5. Database Password (se tiver)

E eu atualizo tudo automaticamente! 🚀

