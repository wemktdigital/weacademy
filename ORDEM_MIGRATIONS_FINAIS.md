# 📋 Ordem das 5 Migrations Finais

## ✅ Migrations Corrigidas e Prontas

Todas as migrations foram corrigidas preventivamente com `DROP IF EXISTS` onde necessário.

---

## 📝 Ordem de Execução Recomendada

### **1. `20251026191000_insert_marketing_medico_templates.sql`** ⭐
- **O que faz:** Insere 16 templates especializados em marketing médico
- **Status:** ✅ Pronta para executar
- **Nota:** Apenas INSERTs, pode gerar duplicatas se executar 2x (mas não quebra)

### **2. `20251026192000_lab_pipeline_templates.sql`** ⭐
- **O que faz:** 
  - Cria tabela `lab_pipeline_templates`
  - Insere 4 templates pré-configurados de pipelines
- **Status:** ✅ Corrigida (DROP IF EXISTS adicionado)
- **Nota:** Cria estrutura + dados

### **3. `20251026191200_create_agents_and_pipeline_post_social.sql`** ⭐
- **O que faz:** 
  - Busca templates de marketing médico
  - Cria agentes a partir dos templates
  - Cria pipeline completo de post social
- **Status:** ✅ Pronta (já tem verificações robustas)
- **Nota:** Requer que os templates de marketing médico existam (migration 1)

### **4. `20251026191100_create_pipeline_post_social.sql`** ⭐ (Opcional)
- **O que faz:** Cria pipeline alternativo buscando agentes já existentes
- **Status:** ✅ Pronta (já tem verificações)
- **Nota:** Use apenas se a migration 3 não funcionar ou se preferir esta abordagem

### **5. `20251026193000_add_draft_to_pipelines.sql`** ⭐
- **O que faz:** 
  - Adiciona campo `draft` aos pipelines
  - Adiciona campo `last_tested_at`
  - Atualiza políticas RLS
- **Status:** ✅ Corrigida (DROP IF EXISTS adicionado)
- **Nota:** Melhoria administrativa, pode ser executada a qualquer momento

---

## 🎯 **Ordem Sugerida:**

```
1. 20251026191000_insert_marketing_medico_templates.sql
2. 20251026192000_lab_pipeline_templates.sql
3. 20251026191200_create_agents_and_pipeline_post_social.sql
4. 20251026193000_add_draft_to_pipelines.sql
5. 20251026191100_create_pipeline_post_social.sql (opcional)
```

---

## ✅ **Todas as Correções Aplicadas:**

- ✅ `20251026192000_lab_pipeline_templates.sql` - DROP IF EXISTS no trigger e políticas
- ✅ `20251026193000_add_draft_to_pipelines.sql` - DROP IF EXISTS na política adicional
- ✅ As outras já tinham verificações adequadas

---

## 🚀 **Pronto para Executar!**

Execute na ordem acima e me avise se alguma der erro! 🎉
