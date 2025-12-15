# 🚀 Aplicar Migrations no Supabase na Nuvem

Este guia explica como aplicar todas as migrations do projeto no banco de dados Supabase na nuvem.

## 📋 Pré-requisitos

- Supabase CLI instalado (já está: `/opt/homebrew/bin/supabase`)
- Acesso ao Supabase na nuvem: `https://supabase-dev.we.marketing`

## 🔧 Método 1: Usando Supabase CLI (Recomendado)

### Passo 1: Linkar o projeto local com o remoto

```bash
cd /Users/edsonmedeiros/Documents/GitHub/weacademy3/weacademy-frontend

# Linkar com o projeto remoto
supabase link --project-ref default --db-url "postgresql://postgres:C7Zt%26yXPVWhphcbnA%40xcCXc@supabase-dev.we.marketing:5432/postgres"
```

**Nota:** O `--project-ref` pode precisar ser ajustado. Se não funcionar, tente sem essa flag ou use o ID do projeto.

### Passo 2: Aplicar todas as migrations

```bash
# Aplicar todas as migrations pendentes
supabase db push
```

Isso vai executar todas as migrations na ordem correta (por timestamp).

---

## 🔧 Método 2: Executar via SQL Editor (Manual)

Se o método do CLI não funcionar, você pode executar as migrations manualmente via SQL Editor:

### Passo 1: Listar migrations em ordem

As migrations estão ordenadas por timestamp no diretório:
```
weacademy-frontend/supabase/migrations/
```

### Passo 2: Executar uma por uma

1. Acesse o SQL Editor no Supabase Dashboard
2. Abra cada arquivo de migration em ordem
3. Execute no SQL Editor

**Ordem das migrations principais:**

1. `20241020000001_initial_schema.sql` - Schema inicial (OBRIGATÓRIO)
2. `20241020000002_rbac_schema.sql` - RBAC e roles
3. `20241020000003_user_preferences.sql` - Preferências de usuário
4. `20241020000004_storage_setup.sql` - Configuração de storage
5. `20241020000005_notifications.sql` - Sistema de notificações
6. ... (demais migrations em ordem cronológica)

---

## 🔧 Método 3: Script SQL Consolidado (Mais Simples)

Criei um script que consolida as migrations principais. Execute no SQL Editor:

**Arquivo:** `apply_all_migrations.sql` (será criado a seguir)

---

## ⚠️ Importante

- **Backup:** Faça backup do banco antes de aplicar migrations
- **Ordem:** As migrations devem ser executadas na ordem correta (por timestamp)
- **Conflitos:** Se alguma migration falhar, verifique se há conflitos de estrutura

---

## ✅ Verificar se funcionou

Após aplicar as migrations, verifique:

```sql
-- Ver todas as tabelas criadas
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Verificar se a tabela profiles existe
SELECT * FROM public.profiles LIMIT 1;

-- Ver migrations aplicadas
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version;
```

---

## 🆘 Problemas Comuns

### Erro: "relation already exists"
- Significa que a tabela já foi criada
- Pule essa migration ou use `CREATE TABLE IF NOT EXISTS`

### Erro: "permission denied"
- Verifique se você tem permissões de administrador no banco
- Use as credenciais do admin fornecidas

### Erro: "extension does not exist"
- Execute: `CREATE EXTENSION IF NOT EXISTS "nome_da_extensao";`
- Extensões comuns: `uuid-ossp`, `pgcrypto`, `pg_trgm`
