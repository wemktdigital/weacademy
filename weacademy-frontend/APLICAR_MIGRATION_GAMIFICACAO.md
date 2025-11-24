# Como Aplicar a Migration de Gamificação

## 🎯 Problema Identificado

A migration de gamificação (`20250120000000_gamification.sql`) não foi aplicada ao banco de dados. Isso causa os seguintes erros:

- ❌ "Could not find the function public.get_user_gamification_stats(p_user_id)"
- ❌ "Could not find the table 'public.achievements'"

## ✅ Solução: Aplicar a Migration

### Opção 1: Via Supabase Dashboard (Recomendado)

1. **Acesse o Supabase Dashboard**
   - Vá para: https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

3. **Cole o conteúdo da migration**
   - Abra o arquivo: `supabase/migrations/20250120000000_gamification.sql`
   - Copie TODO o conteúdo do arquivo
   - Cole no SQL Editor do Supabase

4. **Execute a query**
   - Clique em "Run" ou pressione `Cmd+Enter` (Mac) / `Ctrl+Enter` (Windows/Linux)
   - Aguarde a execução (pode levar alguns segundos)

5. **Verifique se funcionou**
   - Você deve ver uma mensagem de sucesso
   - Tente acessar a aplicação novamente - os erros devem desaparecer

### Opção 2: Via Supabase CLI (Local ou Remoto)

#### Se você usa Supabase Local:

```bash
cd weacademy-frontend

# Verificar se o Supabase está rodando
supabase status

# Se não estiver rodando, inicie:
supabase start

# Aplicar migrations pendentes
supabase migration up

# Ou resetar o banco (aplica todas as migrations):
supabase db reset
```

#### Se você usa Supabase Remoto (Cloud):

```bash
cd weacademy-frontend

# Link com o projeto remoto (se ainda não fez)
supabase link --project-ref seu-project-ref

# Aplicar migrations ao banco remoto
supabase db push
```

### Opção 3: Via Script SQL Direto

Se você tiver acesso direto ao banco de dados via psql ou outra ferramenta:

```bash
# Conecte-se ao banco de dados
psql -h seu-host -U postgres -d postgres

# Execute a migration
\i supabase/migrations/20250120000000_gamification.sql
```

## 📋 O que a Migration Cria

A migration `20250120000000_gamification.sql` cria:

- ✅ **9 tabelas**:
  - `user_points` - Pontos do usuário
  - `user_levels` - Níveis do usuário
  - `achievements` - Conquistas/Badges
  - `user_achievements` - Conquistas desbloqueadas
  - `user_streaks` - Sequências de dias
  - `leaderboard_entries` - Entradas do ranking
  - `gamification_levels_config` - Configuração de níveis
  - `gamification_settings` - Configurações globais
  - `gamification_change_log` - Log de mudanças

- ✅ **8 funções SQL**:
  - `get_user_gamification_stats(p_user_id)` - Estatísticas do usuário
  - `add_user_points(p_user_id, p_points, p_source, p_metadata)` - Adicionar pontos
  - `update_user_level_from_xp(p_user_id, p_total_xp)` - Atualizar nível
  - `check_and_unlock_achievements(p_user_id)` - Verificar conquistas
  - E mais 4 funções auxiliares

- ✅ **5 triggers automáticos**:
  - Atualização automática de níveis quando XP muda
  - Verificação automática de conquistas
  - Atualização de streaks
  - E mais...

- ✅ **20 achievements iniciais** pré-configurados
- ✅ **Configurações padrão** de níveis e pontos

## 🧪 Verificar se Funcionou

Após aplicar a migration, teste:

1. **Acesse a aplicação** no navegador
2. **Verifique o console** - não deve ter mais erros sobre gamificação
3. **Acesse páginas com gamificação**:
   - Dashboard do usuário (`/profile/dashboard`)
   - Página de badges (`/profile/badges`)
   - Leaderboard (`/leaderboard`)

## 🐛 Problemas Comuns

### Erro: "relation already exists"
- Significa que algumas tabelas já existem
- A migration tem `CREATE TABLE IF NOT EXISTS`, então deve ser seguro reexecutar
- Se persistir, verifique se há conflitos de nomes

### Erro: "permission denied"
- Verifique se está usando o usuário correto (deve ser `postgres` ou service role)
- No Dashboard, use a conexão de "Service Role"

### Erro: "function already exists"
- A migration usa `CREATE OR REPLACE FUNCTION`, então deve atualizar automaticamente
- Se persistir, pode ser que precise dropar a função primeiro

## 📞 Precisa de Ajuda?

Se encontrar problemas ao aplicar a migration:

1. **Verifique os logs** no Supabase Dashboard → Logs
2. **Copie o erro completo** que aparecer
3. **Verifique se todas as migrations anteriores** foram aplicadas

---

**Nota**: Se você estiver usando Supabase local, pode precisar reiniciar o serviço após aplicar a migration para que o cache seja atualizado.

