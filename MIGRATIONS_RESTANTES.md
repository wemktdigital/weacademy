# 📋 Migrations Restantes (14 migrations)

## ✅ **Status: 44 de 56 migrations aplicadas (79%)**

---

## ⏳ **Próximas Migrations Prontas (14 migrations)**

### **Grupo 7: Workflows (2 migrations)**

**45. `20251103000015_lab_workflows.sql`** ✅
- Sistema completo de workflows end-to-end
- ✅ Corrigida (1 trigger)

**46. `20251103000016_lab_workflow_blueprints.sql`** ✅
- Blueprints visuais de workflows
- ✅ Corrigida (1 trigger + 1 política)

---

### **Grupo 8: Workflow Versions (2 migrations)**

**47. `20251104000010_lab_workflow_versions_diff.sql`** ✅
- Sistema de diff de versões de workflows
- ✅ Pronta (apenas cria tabela, sem triggers/políticas)

**48. `20251104090000_add_loop_fields_to_workflow_stages.sql`** ✅
- Adiciona campos de loop para stages de workflow
- ✅ Pronta (apenas ALTER TABLE)

---

### **Grupo 9: Workflow Observability (2 migrations)**

**49. `20251105090000_workflow_observability.sql`** ✅
- Observabilidade e métricas de workflows
- ✅ Pronta (apenas ALTER TABLE e VIEWs)

**50. `20251105093000_workflow_human_tasks.sql`** ✅
- Tarefas human-in-the-loop para workflows
- ✅ Pronta (já tem DROP TRIGGER IF EXISTS)

---

### **Grupo 10: Collaborative Teams e Agent Improvements (4 migrations)**

**51. `20251105100000_collaborative_teams.sql`** ✅
- Times colaborativos de agentes
- ✅ Pronta (apenas cria tabelas, sem triggers/políticas)

**52. `20251110000000_add_agent_usage_instructions.sql`** ✅
- Adiciona campos de instruções de uso aos agentes
- ✅ Pronta (apenas ALTER TABLE)

**53. `20251110000001_add_attachments_to_lab_messages.sql`** ✅
- Adiciona campo attachments às mensagens
- ✅ Pronta (apenas ALTER TABLE + índice)

**54. `20251110000002_add_tokens_to_lab_agent_logs.sql`** ✅
- Adiciona tracking de tokens nos logs de agentes
- ✅ Pronta (apenas ALTER TABLE + índice)

---

## 📝 **Ordem de Execução Recomendada**

Execute na ordem numérica acima (45 a 54), seguindo a ordem cronológica.

---

## ✅ **Status**

Todas as 14 migrations restantes estão prontas para execução! 🎉

A maioria são simples (ALTER TABLE, CREATE TABLE) e não precisam de correções preventivas.

---

## 🎯 **Progresso Final**

- **Aplicadas:** 44 migrations ✅
- **Restantes:** 14 migrations ⏳
- **Total:** 56 migrations
- **Progresso:** 79% completo! 🚀
