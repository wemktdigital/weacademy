# 🧪 Teste de Login Direto

O erro na interface do Supabase não significa que o login não funciona. Vamos testar diretamente na aplicação.

## ✅ Teste Rápido

1. **Acesse a aplicação**: http://localhost:3000/auth/login

2. **Tente fazer login** com:
   - Email: `admin@weacademy.com`
   - Senha: `admin123`

3. **Se funcionar**: O provider de email está habilitado, apenas a interface de configuração do Supabase tem problemas.

4. **Se não funcionar e aparecer "Email logins are disabled"**:
   - Isso significa que realmente precisa habilitar via configuração do servidor
   - Você precisará acessar o arquivo de configuração do Supabase no servidor (`config.toml`)

## 🔧 Alternativa: Verificar via API do Supabase

Você também pode testar diretamente via API usando curl:

```bash
curl -X POST 'https://supabase-dev.we.marketing/auth/v1/token?grant_type=password' \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.ewogICJyb2xlIjogImFub24iLAogICJpc3MiOiAic3VwYWJhc2UiLAogICJpYXQiOiAxNzE1MDUwODAwLAogICJleHAiOiAxODcyODE3MjAwCn0.lf7dNW5DT98mIC9kt44hZOmbWLug692uNRExjEP1ObQ" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@weacademy.com",
    "password": "admin123"
  }'
```

Se retornar um `access_token`, o login funciona e o email provider está habilitado.

## 📝 Nota Importante

Em Supabase auto-hospedado, o email provider geralmente **já vem habilitado por padrão**. O erro na interface web pode ser apenas um problema de UI/API, mas o login pode funcionar normalmente.
