# 🚀 Aplicar Migration de Gamificação - PASSO A PASSO

## ⚡ Opção Mais Rápida: Supabase Studio Local

Como você está usando Supabase local, siga estes passos:

### 1. Acesse o Supabase Studio
Abra no navegador: **http://127.0.0.1:54323**

### 2. Vá para o SQL Editor
- No menu lateral esquerdo, clique em **"SQL Editor"**
- Clique no botão **"New query"** (canto superior direito)

### 3. Copie e cole a migration
- Abra o arquivo: `weacademy-frontend/supabase/migrations/20250120000000_gamification.sql`
- Selecione TODO o conteúdo (Cmd+A / Ctrl+A)
- Copie (Cmd+C / Ctrl+C)
- Cole no SQL Editor do Supabase Studio (Cmd+V / Ctrl+V)

### 4. Execute
- Clique no botão **"Run"** (canto inferior direito)
- Ou pressione: **Cmd+Enter** (Mac) / **Ctrl+Enter** (Windows/Linux)

### 5. Aguarde
- A execução pode levar alguns segundos (a migration é grande)
- Você verá mensagens de sucesso no painel de resultados

### 6. Verifique
- Recarregue a aplicação no navegador
- Os erros de gamificação devem desaparecer!

---

## 🔄 Alternativa: Via Terminal (se tiver psql instalado)

Se você tiver o `psql` instalado:

```bash
cd /Users/edsonmedeiros/Documents/GitHub/weacademy3/weacademy-frontend

# Aplicar migration diretamente
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -f supabase/migrations/20250120000000_gamification.sql
```

---

## ✅ Depois de aplicar

1. **Reinicie o servidor Next.js** (se necessário)
2. **Acesse a aplicação** no navegador
3. **Verifique o console** - não deve ter mais erros
4. **Teste páginas de gamificação**:
   - `/profile/dashboard`
   - `/profile/badges`
   - `/leaderboard`

---

**Nota**: A migration é segura para reexecutar (usa `CREATE TABLE IF NOT EXISTS` e `CREATE OR REPLACE FUNCTION`)

