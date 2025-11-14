# ⚡ Quick Start - Deploy Rápido

## 🎯 Resumo em 5 Passos

### 1️⃣ Criar Projeto Supabase
- Acesse [app.supabase.com](https://app.supabase.com)
- Crie novo projeto
- Anote: Project URL, anon key, service_role key

### 2️⃣ Migrar Banco de Dados
```bash
cd weacademy-frontend
supabase login
supabase link --project-ref SEU-PROJECT-REF
supabase db push
```

### 3️⃣ Configurar Storage
- No Supabase Dashboard → Storage
- Crie buckets: `knowledge-base`, `certificates`, `course-materials`, `avatars`

### 4️⃣ Deploy na Vercel
- Acesse [vercel.com](https://vercel.com)
- Importe repositório GitHub
- **Root Directory**: `weacademy-frontend` ⚠️
- Configure variáveis de ambiente (veja lista abaixo)
- Deploy!

### 5️⃣ Variáveis de Ambiente na Vercel
```
NEXT_PUBLIC_SUPABASE_URL=https://seu-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
NEXT_PUBLIC_APP_URL=https://seu-projeto.vercel.app
NEXT_PUBLIC_SUPABASE_STORAGE_URL=https://seu-ref.supabase.co/storage/v1
```

---

## 📋 Checklist Rápido

- [ ] Projeto Supabase criado
- [ ] Migrations aplicadas (`supabase db push`)
- [ ] Storage buckets criados
- [ ] Variáveis configuradas na Vercel
- [ ] Deploy realizado
- [ ] App funcionando!

---

📖 **Guia completo**: Veja `DEPLOY_VERCEL.md` para instruções detalhadas

