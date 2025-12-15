# 📋 Migrations Pendentes - Erros Identificados

## ❌ Erros Encontrados no Console

Os erros indicam que várias migrations precisam ser aplicadas:

### 1. **Sistema de Gamificação** (CRÍTICO)
- Erro: "Sistema de gamificação não inicializado"
- Migration necessária: `20250120000000_gamification.sql`

### 2. **Tabelas do Lab IA** (CRÍTICO)
- Erros 404/500 em:
  - `lab_conversations`
  - `lab_video_operations`
  - `lab_agents`
  - `lab_pipelines`
- Migrations necessárias:
  - `20251026105808_lab_ia_schema.sql`
  - `20251115000000_lab_video_operations.sql`
  - E outras relacionadas ao lab

### 3. **Notificações** (IMPORTANTE)
- Erro 404 em: `notifications`
- Migration necessária: `20241020000005_notifications.sql`

### 4. **Função track_event** (IMPORTANTE)
- Erro 404 em: `rpc/track_event`
- Provavelmente em: `20241020000006_audit_logs.sql` ou `20241020000007_events.sql`

---

## 🎯 Solução: Aplicar Todas as Migrations

Você tem **2 opções**:

### Opção 1: Aplicar todas as migrations de uma vez (Recomendado)

Execute todas as migrations em ordem cronológica no SQL Editor do Supabase.com.

### Opção 2: Aplicar apenas as essenciais primeiro

Aplique primeiro as migrations essenciais para o login funcionar:
1. `apply_essential_migrations.sql` (já criado)
2. `20241020000005_notifications.sql`
3. `20250120000000_gamification.sql`
4. Depois as do lab-ia se necessário

---

## 📝 Ordem Recomendada

Execute as migrations nesta ordem:

1. ✅ `apply_essential_migrations.sql` (já deve ter aplicado)
2. ⏳ `20241020000004_storage_setup.sql`
3. ⏳ `20241020000005_notifications.sql`
4. ⏳ `20241020000006_audit_logs.sql`
5. ⏳ `20241020000007_events.sql`
6. ⏳ `20250120000000_gamification.sql` (para resolver erros de gamificação)
7. ⏳ `20251026105808_lab_ia_schema.sql` (se usar lab-ia)
8. ⏳ Demais migrations do lab-ia em ordem cronológica

---

## ⚠️ Importante

Muitos desses erros são de funcionalidades opcionais (gamificação, lab-ia). O essencial para login funcionar são:

1. ✅ Schema inicial (profiles, courses, etc.)
2. ✅ RBAC (roles)
3. ⏳ Notifications (se a aplicação usar)

Você pode aplicar as migrations gradualmente conforme a necessidade.

---

## 🚀 Quer que eu crie um script consolidado?

Posso criar um script SQL que consolida todas as migrations essenciais (incluindo gamificação e notificações) para você executar de uma vez!
