# 🚀 Executar Criação de Agentes e Pipeline

Este guia mostra como executar a migração SQL que cria os agentes e o pipeline automaticamente.

## ✅ Pré-requisitos

- ✅ Templates importados (você já fez isso!)
- ✅ Acesso ao Supabase Dashboard como admin

## 🛠️ Como Executar

### Método 1: Via Supabase Dashboard (Mais Fácil)

1. **Acesse o Supabase Dashboard:**
   - Abra https://supabase.com/dashboard
   - Selecione seu projeto

2. **Abra o SQL Editor:**
   - No menu lateral, clique em "SQL Editor"
   - Clique em "New query"

3. **Cole o conteúdo do arquivo SQL:**
   - Abra o arquivo: `supabase/migrations/20250130000002_create_agents_and_pipeline_post_social.sql`
   - Copie TODO o conteúdo
   - Cole no SQL Editor do Supabase

4. **Execute:**
   - Clique em "Run" ou pressione `Ctrl+Enter` (Windows/Linux) ou `Cmd+Enter` (Mac)
   - Aguarde a execução

5. **Verifique os logs:**
   - Os logs aparecerão no painel de resultados
   - Você verá mensagens como:
     - ✅ "Templates encontrados!"
     - ✅ "Agente criado: [UUID]"
     - ✅ "Pipeline criado: [UUID]"

### Método 2: Via Supabase CLI

```bash
cd /Users/edsonmedeiros/Documents/GitHub/weacademy3/weacademy-frontend
supabase db push
```

Ou execute diretamente:

```bash
supabase db execute --file supabase/migrations/20250130000002_create_agents_and_pipeline_post_social.sql
```

## ✅ Como Verificar se Funcionou

### 1. Verificar Agentes Criados

No SQL Editor do Supabase, execute:

```sql
SELECT id, name, active, created_at
FROM lab_agents
WHERE name IN (
  'Criador de Postagens Sociais Médicas',
  'Auditor de Compliance Médico',
  'Especialista em SEO Médico'
)
ORDER BY created_at DESC;
```

Você deve ver 3 agentes (ou 2, se SEO não foi criado).

### 2. Verificar Pipeline Criado

```sql
SELECT 
  id,
  name,
  description,
  jsonb_array_length(steps) as num_steps,
  active,
  created_at
FROM lab_agent_pipelines
WHERE name = 'Criação Completa de Post Social';
```

Você deve ver o pipeline com 2 ou 3 etapas.

### 3. Verificar na Interface

1. **Agentes:**
   - Acesse `/ai-lab/admin/agents`
   - Você deve ver os novos agentes na lista

2. **Pipeline:**
   - Acesse `/ai-lab/admin/pipelines`
   - Você deve ver o card "Criação Completa de Post Social"

### 4. Testar o Pipeline

1. Acesse `/ai-lab`
2. No `PipelineSelector` (ícone 🔗), selecione "Criação Completa de Post Social"
3. Envie uma mensagem: "Crie um post sobre vacinação contra gripe para Instagram"
4. O pipeline executará todas as etapas e retornará o resultado validado

## 🐛 Solução de Problemas

### Erro: "Template não encontrado"

**Causa:** Os templates ainda não foram importados.

**Solução:** 
1. Importe os templates primeiro via interface: `/ai-lab/admin/agents/templates`
2. Use o arquivo `templates-marketing-medico.json`
3. Depois execute a migração SQL novamente

### Erro: "Agente já existe"

**Ação:** O script detecta se o agente já existe e pula a criação. Isso é normal!

### Pipeline não aparece

**Verificar:**
1. Se o pipeline foi criado via SQL (execute a query de verificação)
2. Se o pipeline está ativo (`active = true`)
3. Recarregue a página

## 📋 O que o Script Faz

1. ✅ Busca os 3 templates necessários pelos nomes
2. ✅ Cria os agentes a partir dos templates (se ainda não existirem)
3. ✅ Cria o pipeline com as etapas corretas
4. ✅ Usa 3 etapas se SEO estiver disponível, senão usa 2 etapas

## 🎉 Pronto!

Após executar, você terá:
- ✅ 2-3 agentes criados e ativos
- ✅ 1 pipeline pronto para uso
- ✅ Tudo funcionando em `/ai-lab`

