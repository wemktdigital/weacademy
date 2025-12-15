# 🔧 Habilitar Email Provider no Supabase Auth

## 📋 Status Atual

✅ A tabela `auth.instances` existe (confirmado)
❌ Email provider está desabilitado (erro ao fazer login)
❌ Interface web não funciona (erro ao salvar configuração)

## 🎯 Solução: Habilitar via SQL

Como a interface web não funciona, vamos habilitar diretamente via SQL na tabela `auth.instances`.

### Passo 1: Verificar Configuração Atual

Execute no SQL Editor:

```sql
-- Ver configuração atual
SELECT 
    id,
    raw_base_config
FROM auth.instances
ORDER BY created_at DESC
LIMIT 1;
```

**Analise o resultado:** Veja o formato do JSON para entender a estrutura.

### Passo 2: Verificar Status do Email

Execute:

```sql
SELECT 
    raw_base_config->'external'->'email'->>'enabled' as email_enabled,
    raw_base_config->'external'->'email' as email_config
FROM auth.instances
LIMIT 1;
```

### Passo 3: Habilitar Email Provider

**Opção A: Usar o script automático**

Execute o arquivo: `enable_email_via_sql.sql`

**Opção B: Update manual (se o script não funcionar)**

```sql
-- ATENÇÃO: Ajuste conforme o formato do seu JSON
UPDATE auth.instances
SET raw_base_config = jsonb_set(
    raw_base_config::jsonb,
    '{external,email,enabled}',
    'true'::jsonb
)::text,
updated_at = NOW()
WHERE id = (SELECT id FROM auth.instances ORDER BY created_at DESC LIMIT 1);
```

### Passo 4: Reiniciar Serviço Auth

Após atualizar, você pode precisar reiniciar o serviço auth no servidor:

```bash
# No servidor onde o Supabase está rodando
docker restart supabase-auth
# ou
systemctl restart supabase-auth
```

### Passo 5: Testar Login

Tente fazer login novamente:
- Email: `admin@weacademy.com`
- Senha: `admin123`

## ⚠️ Importante

- O formato do JSON em `raw_base_config` pode variar entre versões do Supabase
- Se o update não funcionar, pode ser necessário verificar o formato exato do JSON
- Em alguns casos, pode ser necessário reiniciar o serviço auth

## 🔍 Se não funcionar

1. Compartilhe o resultado do `raw_base_config` (formato do JSON)
2. Verifique os logs do serviço auth no servidor
3. Pode ser necessário atualizar a estrutura do JSON de forma diferente
