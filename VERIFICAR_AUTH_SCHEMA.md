# 🔍 Verificar Schema do Supabase Auth

Este guia ajuda a verificar se o schema do Supabase Auth está completo e atualizado.

## 📋 Passo 1: Executar Script de Verificação

1. Acesse o **SQL Editor** no Supabase Dashboard
2. Execute o script: `check_auth_schema.sql`
3. Analise os resultados abaixo

## ✅ O que verificar:

### 1. Tabelas do Schema Auth

Devem existir pelo menos estas tabelas:
- ✅ `auth.users` (já confirmado que existe)
- ✅ `auth.instances` (necessária para configurações)
- ✅ `auth.refresh_tokens`
- ✅ `auth.audit_log_entries`
- ✅ Outras tabelas do auth

### 2. Tabela `auth.instances`

Esta tabela é **CRUCIAL** - é onde o Supabase Auth salva as configurações dos providers.

**Se a tabela NÃO existir:** As migrations do Supabase Auth não foram executadas.

**Estrutura esperada:**
- `id` (uuid)
- `uuid` (uuid)
- `raw_base_config` (jsonb ou text) - onde as configurações são salvas
- `created_at`, `updated_at`

### 3. Extensões

Devem estar habilitadas:
- `pgcrypto` (para criptografia de senhas)
- `uuid-ossp` (para gerar UUIDs)

## 🔧 Passo 2: Verificar Logs do Supabase Auth

Se você tem acesso ao servidor, verifique os logs:

```bash
# Se estiver usando Docker
docker logs supabase-auth

# Ou verifique os logs do serviço auth
journalctl -u supabase-auth -n 100
```

**Procure por erros como:**
- `column does not exist`
- `relation "auth.instances" does not exist`
- `permission denied`
- Erros SQL relacionados a `auth.config`

## 🔧 Passo 3: Verificar Migrations do Supabase Auth

As migrations do Supabase Auth são diferentes das migrations do seu projeto. Elas geralmente são executadas automaticamente quando o Supabase é iniciado, mas podem falhar.

**Para verificar se foram executadas:**

```sql
-- Verificar se há tabela de controle de migrations do auth
SELECT * FROM supabase_migrations.schema_migrations 
WHERE name LIKE '%auth%'
ORDER BY version DESC;
```

## 🚨 Se a tabela `auth.instances` não existir:

Você precisará executar as migrations do Supabase Auth. Isso geralmente é feito automaticamente, mas pode falhar se:

1. O schema `auth` não existe
2. Permissões insuficientes
3. Versão incompatível do PostgreSQL

**Solução:** Execute as migrations do Supabase Auth manualmente ou reinicie o serviço auth.

## 📝 Próximos Passos

Após executar o script, me envie os resultados para analisarmos o que está faltando.
