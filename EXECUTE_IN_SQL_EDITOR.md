# 📝 Executar Migrations no SQL Editor do Supabase

Como o banco está vazio, você precisa executar as migrations manualmente via SQL Editor.

## 🎯 Opção 1: Executar migrations individuais (Recomendado)

As migrations estão em: `weacademy-frontend/supabase/migrations/`

Execute cada arquivo **em ordem cronológica** (por timestamp) no SQL Editor:

### Migrations Essenciais (Execute PRIMEIRO):

1. **`20241020000001_initial_schema.sql`** ⭐ OBRIGATÓRIO
   - Cria todas as tabelas básicas (profiles, courses, modules, etc.)
   - Cria funções e triggers
   - Configura RLS

2. **`20241020000002_rbac_schema.sql`**
   - Atualiza roles (admin, user, guest)
   - Políticas RBAC

3. **`20241020000003_user_preferences.sql`**
   - Preferências de usuário

4. **`20241020000008_fix_user_trigger.sql`**
   - Corrige trigger de criação de usuário

### Depois execute as demais migrations em ordem:
- `20241020000004_storage_setup.sql`
- `20241020000005_notifications.sql`
- `20241020000006_audit_logs.sql`
- ... (demais migrations por data)

---

## 🎯 Opção 2: Script SQL Consolidado (Mais Rápido)

Criei um script consolidado que você pode executar de uma vez.

**Arquivo:** `apply_essential_migrations.sql`

⚠️ **Nota:** Este script contém apenas as migrations essenciais. Execute as demais depois se necessário.

---

## 📋 Como Executar:

1. Acesse: https://supabase-dev.we.marketing
2. Vá em **SQL Editor** (na barra lateral)
3. Cole o conteúdo do script
4. Clique em **Run** (ou Cmd+Enter)
5. Verifique se não houve erros

---

## ✅ Verificar se Funcionou:

Após executar, rode este SQL:

```sql
-- Ver tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar tabela profiles
SELECT * FROM public.profiles LIMIT 1;
```

Você deve ver as tabelas: `profiles`, `courses`, `modules`, `lessons`, etc.

---

## 🎯 Depois das Migrations:

Execute o script `create_users_admin_user.sql` para criar os usuários Admin e User.
