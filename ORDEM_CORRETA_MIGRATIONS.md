# 📋 Ordem Correta das Migrations

## ⚠️ Erro Encontrado

A migration `20250120000000_gamification.sql` depende da tabela `quiz_attempts`, que é criada na migration `20241020000011_quizzes.sql`.

## ✅ Solução

Execute as migrations nesta ordem:

### 1. Migrations Básicas (já aplicadas ✅)
- ✅ `20241020000001_initial_schema.sql`
- ✅ `20241020000002_rbac_schema.sql`
- ✅ `20241020000008_fix_user_trigger.sql`

### 2. Migrations Complementares
- ✅ `20241020000004_storage_setup.sql` (já aplicado)
- ✅ `20241020000005_notifications.sql` (já aplicado)
- ✅ `20241020000006_audit_logs.sql` (já aplicado)
- ✅ `20241020000007_events.sql` (já aplicado)

### 3. Migrations de Cursos (ANTES da gamificação)
- ⏳ `20241020000009_complete_courses.sql`
- ⏳ `20241020000010_cohorts.sql`
- ⏳ `20241020000011_quizzes.sql` ⭐ **OBRIGATÓRIO antes de gamificação**
- ⏳ `20241020000012_certificates.sql`

### 4. Migrations de Gamificação (DEPOIS de quizzes)
- ⏳ `20250120000000_gamification.sql` ⭐ **Execute DEPOIS de quizzes**
- ⏳ `20250120000001_add_memory_settings.sql`
- ⏳ `20250124000001_update_notifications_metadata.sql`

### 5. Migrations do Lab IA (opcional, se usar)
- ⏳ `20251026105808_lab_ia_schema.sql`
- ⏳ E demais migrations do lab em ordem cronológica

---

## 🎯 Execute Agora

No SQL Editor do Supabase.com, execute nesta ordem:

1. **`20241020000009_complete_courses.sql`**
2. **`20241020000010_cohorts.sql`**
3. **`20241020000011_quizzes.sql`** ⭐ **CRÍTICO**
4. **`20241020000012_certificates.sql`**
5. **`20250120000000_gamification.sql`** ⭐ **Agora vai funcionar!**

---

## 📝 Depois de aplicar quizzes

A migration de gamificação deve funcionar sem erros!
