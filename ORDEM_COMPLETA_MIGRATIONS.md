# 📋 Ordem Completa de Todas as 28 Migrations Pendentes

## ✅ Migrations Corrigidas Preventivamente

- ✅ `20251027000000_add_favorite_to_conversations.sql` - Pronta (simples)
- ✅ `20251103000001_lab_pipeline_schedules.sql` - Corrigida (triggers + 13 políticas)
- ✅ `20251103000002_lab_pipeline_api_keys.sql` - Corrigida (trigger + 8 políticas)

---

## 📝 **Ordem de Execução Completa**

### **Grupo 1: Outubro 2025 (1 migration)**

**29. `20251027000000_add_favorite_to_conversations.sql`** ✅
- Adiciona campo `is_favorite` à tabela `lab_conversations`
- Pronta para executar

---

### **Grupo 2: Novembro 2025 - Pipelines e Schedules (2 migrations)**

**30. `20251103000001_lab_pipeline_schedules.sql`** ✅
- Sistema de agendamento de pipelines (cron, interval, webhook, event)
- Corrigida preventivamente

**31. `20251103000002_lab_pipeline_api_keys.sql`** ✅
- API keys para acesso público aos pipelines
- Corrigida preventivamente

---

### **Grupo 3: Knowledge Base e Cost Management (3 migrations)**

**32. `20251103000003_lab_knowledge_base.sql`**
- Sistema completo de knowledge base
- ⚠️ Verificar e corrigir antes de aplicar

**33. `20251103000004_lab_cost_analytics.sql`**
- Analytics de custos
- ⚠️ Verificar e corrigir antes de aplicar

**34. `20251103000004_lab_cost_estimation.sql`**
- Estimativa de custos
- ⚠️ Nota: Mesmo timestamp que cost_analytics, verificar ordem

---

### **Grupo 4: Debug, Versionamento e A/B Testing (3 migrations)**

**35. `20251103000005_lab_debug_mode.sql`**
- Modo debug para pipelines/agentes
- ⚠️ Verificar e corrigir antes de aplicar

**36. `20251103000006_lab_pipeline_versioning.sql`**
- Versionamento de pipelines
- ⚠️ Verificar e corrigir antes de aplicar

**37. `20251103000007_lab_ab_testing.sql`**
- Sistema de A/B testing
- ⚠️ Verificar e corrigir antes de aplicar

---

### **Grupo 5: Analytics e Medical Analysis (4 migrations)**

**38. `20251103000008_lab_advanced_analytics.sql`**
- Analytics avançado
- ⚠️ Verificar e corrigir antes de aplicar

**39. `20251103000009_lab_medical_analyses.sql`**
- Análises médicas
- ⚠️ Verificar e corrigir antes de aplicar

**40. `20251103000010_insert_medical_analysis_agents.sql`**
- Insere agentes de análise médica
- ⚠️ Verificar e corrigir antes de aplicar

**41. `20251103000011_create_medical_storage_buckets.sql`**
- Cria buckets de storage para análises médicas
- ⚠️ Verificar e corrigir antes de aplicar

---

### **Grupo 6: Model Performance (3 migrations)**

**42. `20251103000012_lab_model_performance.sql`**
- Tracking de performance de modelos
- ⚠️ Verificar e corrigir antes de aplicar

**43. `20251103000013_lab_routing_preferences.sql`**
- Preferências de roteamento
- ⚠️ Verificar e corrigir antes de aplicar

**44. `20251103000014_lab_model_feedback.sql`**
- Sistema de feedback de modelos
- ⚠️ Verificar e corrigir antes de aplicar

---

### **Grupo 7: Workflows (2 migrations)**

**45. `20251103000015_lab_workflows.sql`**
- Sistema de workflows
- ⚠️ Verificar e corrigir antes de aplicar

**46. `20251103000016_lab_workflow_blueprints.sql`**
- Blueprints de workflows
- ⚠️ Requer `lab_workflows` (migration 45)

---

### **Grupo 8: Workflow Versions (2 migrations)**

**47. `20251104000010_lab_workflow_versions_diff.sql`**
- Diff de versões de workflows
- ⚠️ Requer `lab_workflows` (migration 45)

**48. `20251104090000_add_loop_fields_to_workflow_stages.sql`**
- Campos de loop para stages de workflow
- ⚠️ Requer `lab_workflows` (migration 45)

---

### **Grupo 9: Workflow Observability (2 migrations)**

**49. `20251105090000_workflow_observability.sql`**
- Observabilidade de workflows
- ⚠️ Requer `lab_workflows` (migration 45)

**50. `20251105093000_workflow_human_tasks.sql`**
- Tarefas humanas em workflows
- ⚠️ Requer `lab_workflows` (migration 45)

---

### **Grupo 10: Collaborative Teams e Agent Improvements (4 migrations)**

**51. `20251105100000_collaborative_teams.sql`**
- Times colaborativos
- ⚠️ Verificar e corrigir antes de aplicar

**52. `20251110000000_add_agent_usage_instructions.sql`**
- Instruções de uso para agentes
- ⚠️ Verificar e corrigir antes de aplicar

**53. `20251110000001_add_attachments_to_lab_messages.sql`**
- Anexos em mensagens
- ⚠️ Verificar e corrigir antes de aplicar

**54. `20251110000002_add_tokens_to_lab_agent_logs.sql`**
- Tracking de tokens nos logs de agentes
- ⚠️ Verificar e corrigir antes de aplicar

---

## 🎯 **Estratégia Recomendada**

1. **Aplicar Grupo 1** (1 migration) - Simples e pronta
2. **Aplicar Grupo 2** (2 migrations) - Já corrigidas
3. **Aplicar Grupos 3-10** (25 migrations) - Verificar e corrigir antes de aplicar cada uma

---

## ⚠️ **Importante**

- As migrations marcadas com ⚠️ precisam ser verificadas e corrigidas antes de aplicar
- Algumas têm dependências explícitas (workflows)
- Aplique em ordem cronológica para evitar problemas de dependência

---

## 🚀 **Próximo Passo**

Execute as migrations na ordem acima, começando pelo Grupo 1 e Grupo 2 que já estão prontas!
