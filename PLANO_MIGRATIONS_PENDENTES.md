# 📋 Plano de Aplicação das 28 Migrations Pendentes

## ✅ Status: Preparando para aplicar todas

---

## 📅 **Grupo 1: Outubro 2025 (1 migration)**

### 29. `20251027000000_add_favorite_to_conversations.sql`
- **O que faz:** Adiciona campo `is_favorite` à tabela `lab_conversations`
- **Dependências:** Requer `lab_conversations` (já existe)
- **Status:** ✅ Pronta (migration simples)

---

## 📅 **Grupo 2: Novembro 2025 - Pipelines e Schedules (2 migrations)**

### 30. `20251103000001_lab_pipeline_schedules.sql`
- **O que faz:** Sistema de agendamento de pipelines (cron, interval, webhook, event)
- **Dependências:** Requer `lab_agent_pipelines` (já existe)
- **Status:** ⏳ Verificar e corrigir

### 31. `20251103000002_lab_pipeline_api_keys.sql`
- **O que faz:** API keys para pipelines
- **Dependências:** Requer `lab_agent_pipelines` (já existe)
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 3: Knowledge Base e Cost Management (3 migrations)**

### 32. `20251103000003_lab_knowledge_base.sql`
- **O que faz:** Sistema completo de knowledge base
- **Dependências:** Possivelmente `lab_agents` (já existe)
- **Status:** ⏳ Verificar e corrigir

### 33. `20251103000004_lab_cost_analytics.sql`
- **O que faz:** Analytics de custos
- **Dependências:** Possivelmente `lab_agent_logs` (já existe)
- **Status:** ⏳ Verificar e corrigir

### 34. `20251103000004_lab_cost_estimation.sql`
- **O que faz:** Estimativa de custos
- **Nota:** Mesmo timestamp que cost_analytics, verificar ordem
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 4: Debug, Versionamento e A/B Testing (3 migrations)**

### 35. `20251103000005_lab_debug_mode.sql`
- **O que faz:** Modo debug para pipelines/agentes
- **Status:** ⏳ Verificar e corrigir

### 36. `20251103000006_lab_pipeline_versioning.sql`
- **O que faz:** Versionamento de pipelines
- **Dependências:** Requer `lab_agent_pipelines` (já existe)
- **Status:** ⏳ Verificar e corrigir

### 37. `20251103000007_lab_ab_testing.sql`
- **O que faz:** Sistema de A/B testing
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 5: Analytics e Medical Analysis (4 migrations)**

### 38. `20251103000008_lab_advanced_analytics.sql`
- **O que faz:** Analytics avançado
- **Status:** ⏳ Verificar e corrigir

### 39. `20251103000009_lab_medical_analyses.sql`
- **O que faz:** Análises médicas
- **Status:** ⏳ Verificar e corrigir

### 40. `20251103000010_insert_medical_analysis_agents.sql`
- **O que faz:** Insere agentes de análise médica
- **Dependências:** Requer `lab_agents` (já existe)
- **Status:** ⏳ Verificar e corrigir

### 41. `20251103000011_create_medical_storage_buckets.sql`
- **O que faz:** Cria buckets de storage para análises médicas
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 6: Model Performance (3 migrations)**

### 42. `20251103000012_lab_model_performance.sql`
- **O que faz:** Tracking de performance de modelos
- **Status:** ⏳ Verificar e corrigir

### 43. `20251103000013_lab_routing_preferences.sql`
- **O que faz:** Preferências de roteamento
- **Status:** ⏳ Verificar e corrigir

### 44. `20251103000014_lab_model_feedback.sql`
- **O que faz:** Sistema de feedback de modelos
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 7: Workflows (2 migrations)**

### 45. `20251103000015_lab_workflows.sql`
- **O que faz:** Sistema de workflows
- **Status:** ⏳ Verificar e corrigir

### 46. `20251103000016_lab_workflow_blueprints.sql`
- **O que faz:** Blueprints de workflows
- **Dependências:** Requer `lab_workflows` (migration 45)
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 8: Workflow Versions (2 migrations)**

### 47. `20251104000010_lab_workflow_versions_diff.sql`
- **O que faz:** Diff de versões de workflows
- **Dependências:** Requer `lab_workflows` (migration 45)
- **Status:** ⏳ Verificar e corrigir

### 48. `20251104090000_add_loop_fields_to_workflow_stages.sql`
- **O que faz:** Campos de loop para stages de workflow
- **Dependências:** Requer `lab_workflows` (migration 45)
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 9: Workflow Observability (2 migrations)**

### 49. `20251105090000_workflow_observability.sql`
- **O que faz:** Observabilidade de workflows
- **Dependências:** Requer `lab_workflows` (migration 45)
- **Status:** ⏳ Verificar e corrigir

### 50. `20251105093000_workflow_human_tasks.sql`
- **O que faz:** Tarefas humanas em workflows
- **Dependências:** Requer `lab_workflows` (migration 45)
- **Status:** ⏳ Verificar e corrigir

---

## 📅 **Grupo 10: Collaborative Teams e Agent Improvements (4 migrations)**

### 51. `20251105100000_collaborative_teams.sql`
- **O que faz:** Times colaborativos
- **Status:** ⏳ Verificar e corrigir

### 52. `20251110000000_add_agent_usage_instructions.sql`
- **O que faz:** Instruções de uso para agentes
- **Dependências:** Requer `lab_agents` (já existe)
- **Status:** ⏳ Verificar e corrigir

### 53. `20251110000001_add_attachments_to_lab_messages.sql`
- **O que faz:** Anexos em mensagens
- **Dependências:** Requer `lab_messages` (já existe)
- **Status:** ⏳ Verificar e corrigir

### 54. `20251110000002_add_tokens_to_lab_agent_logs.sql`
- **O que faz:** Tracking de tokens nos logs de agentes
- **Dependências:** Requer `lab_agent_logs` (já existe)
- **Status:** ⏳ Verificar e corrigir

---

## 🎯 **Estratégia de Aplicação**

1. **Aplicar em grupos** conforme ordem cronológica
2. **Corrigir preventivamente** todas as migrations (DROP IF EXISTS)
3. **Verificar dependências** antes de aplicar cada grupo
4. **Aplicar uma por vez** e confirmar sucesso

---

## 🚀 **Vamos começar!**

Vou começar aplicando a primeira migration e depois seguir em ordem cronológica.
