# 🔗 Sprint 8 - Agentes Colaborativos e Pipelines Multi-LLM

**Data:** Janeiro 2025  
**Autor:** WE Academy Development Team

## 📋 Visão Geral

Este sprint implementa o sistema de **pipelines colaborativos de agentes**, permitindo que múltiplos agentes (de diferentes modelos e provedores) executem etapas sequenciais de processamento. O resultado de um agente é passado como entrada para o próximo, criando fluxos complexos de processamento.

## 🎯 Objetivos Alcançados

✅ **Tabelas Database**: `lab_agent_pipelines` e `lab_pipeline_logs`  
✅ **Executor de Pipelines**: Serviço para execução sequencial  
✅ **CRUD Completo**: APIs e UI para gerenciar pipelines  
✅ **Logging**: Registro de execuções com métricas  
✅ **Multi-Provedor**: Suporte a diferentes LLMs  
✅ **Validação**: Schema Zod para pipelines e steps  

## 📦 Arquivos Criados

### Database

- `supabase/migrations/20251026170000_lab_pipelines.sql` - Tabelas de pipelines e logs

### APIs

- `src/app/api/lab-ia/admin/pipelines/route.ts` - GET e POST
- `src/app/api/lab-ia/admin/pipelines/[id]/route.ts` - PUT e DELETE

### Frontend

- `src/app/ai-lab/admin/pipelines/page.tsx` - Página CRUD de pipelines
- `src/lib/validations/pipeline.schema.ts` - Schema Zod
- `src/modules/laboratorio-ia/services/pipelineRunner.ts` - Executor

### Documentação

- `docs/README_SPRINT8.md` - Esta documentação

## 🗄️ Banco de Dados

### Tabela `lab_agent_pipelines`

```sql
CREATE TABLE lab_agent_pipelines (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  steps JSONB NOT NULL, -- [{order:1, agent_id:'uuid'}, {order:2, agent_id:'uuid'}]
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Tabela `lab_pipeline_logs`

```sql
CREATE TABLE lab_pipeline_logs (
  id BIGINT PRIMARY KEY,
  pipeline_id UUID,
  user_id UUID,
  input_messages JSONB,
  output_messages JSONB,
  steps_executed INTEGER,
  total_latency_ms INTEGER,
  total_cost_usd NUMERIC,
  created_at TIMESTAMPTZ
);
```

## 🔧 Executor de Pipeline

### Função Principal

```typescript
export async function runPipeline(
  pipelineId: string,
  inputMessages: any[],
  userId: string
): Promise<PipelineResult>
```

### Fluxo de Execução

1. **Busca Pipeline**: Carrega definição do pipeline
2. **Ordena Steps**: Organiza por campo `order`
3. **Executa Sequencialmente**:
   - Para cada step, busca o agente
   - Executa com o contexto do agente anterior
   - Passa output como entrada para o próximo
4. **Registra Logs**: Salva execução completa
5. **Retorna Resultado**: Output final + métricas

### Exemplo de Pipeline

```json
{
  "name": "Resumo → Revisão → Tradução",
  "steps": [
    {"order": 1, "agent_id": "uuid-resumo"},
    {"order": 2, "agent_id": "uuid-revisao"},
    {"order": 3, "agent_id": "uuid-traducao"}
  ]
}
```

**Fluxo de Execução:**
1. Input: "Resuma este artigo científico"
2. Agente 1 (Resumo): → "Resumo do artigo..."
3. Agente 2 (Revisão): → "Resumo revisado..."
4. Agente 3 (Tradução): → "Summarized article..."
5. Output: Resultado final traduzido

## 📡 APIs Criadas

### GET `/api/lab-ia/admin/pipelines`

Lista pipelines com paginação.

### POST `/api/lab-ia/admin/pipelines`

Cria novo pipeline (RBAC: admin/gestor_we).

### PUT `/api/lab-ia/admin/pipelines/[id]`

Atualiza pipeline existente.

### DELETE `/api/lab-ia/admin/pipelines/[id]`

Exclui pipeline.

## 🎨 UI/UX

### Página de Pipelines

**Características:**
- Listagem em cards
- Mostra número de etapas
- Visualiza agentes envolvidos
- Botões de editar e excluir
- Badge de status (ativo/inativo)

**Formulário de Criação:**
- Nome e descrição
- Adicionar steps sequenciais
- Selecionar agente para cada step
- Reordenação automática
- Visualização da ordem

**Fluxo de Uso:**
1. Admin acessa `/ai-lab/admin/pipelines`
2. Clica em "+ Novo Pipeline"
3. Adiciona steps (Agente 1, Agente 2, Agente 3)
4. Salva o pipeline
5. Pipeline fica disponível para uso

## 🚀 Uso Avançado

### Executar Pipeline no Chat

```typescript
// Na UI do chat, selecionar um pipeline
// O sistema automaticamente:
1. Executa todos os agentes em sequência
2. Retorna apenas o resultado final
3. Mostra badge "Pipeline ativo: Nome → Nome → Nome"
4. Registra logs automaticamente
```

### Exemplo Prático

**Pipeline: Análise Completa de Artigo**
- Step 1: Resumir Artigo (Agente Resumo)
- Step 2: Extrair Insights (Agente Insights)
- Step 3: Gerar Recomendações (Agente Recomendações)

**Input**: Artigo científico completo  
**Output**: Resumo + Insights + Recomendações em uma única resposta

## 📊 Logs e Métricas

Cada execução registra:
- **Input/Output**: Mensagens completas
- **Etapas Executadas**: Número de steps
- **Latência Total**: Tempo completo
- **Custo Total**: Soma de todos os agentes
- **Timestamp**: Data/hora

**Consultar Logs:**
```sql
SELECT * FROM lab_pipeline_logs 
WHERE pipeline_id = 'uuid' 
ORDER BY created_at DESC;
```

## 🔒 Segurança

- **RLS**: Pipelines visíveis conforme políticas
- **RBAC**: Apenas admin/gestor_we podem criar/editar
- **Validação**: Schema Zod em todas as operações
- **Logs**: Registro de todas as execuções

## 🎯 Casos de Uso

1. **Processamento Multi-Etapas**
   - Resumir → Traduzir → Revisar
   - Analisar → Sugerir → Implementar

2. **Pipelines Especializados**
   - Marketing: Criar → Otimizar → Publicar
   - Pesquisa: Analisar → Resumir → Validar

3. **Mistura de Modelos**
   - GPT para escrita + Gemini para análise
   - Modelo rápido + Modelo preciso

## 📈 Melhorias Futuras

- [ ] Interface visual de flowchart (ReactFlow)
- [ ] Execução paralela para steps independentes
- [ ] Condicionais (if/else) no pipeline
- [ ] Loops e iterações
- [ ] Branching (não apenas sequencial)
- [ ] Cache intermediário de resultados
- [ ] Retry automático em caso de falha
- [ ] Métricas de performance por step

## 🧪 Testes

### Pipeline Simples (2 Steps)

```typescript
const pipeline = {
  name: "Test Pipeline",
  steps: [
    { order: 1, agent_id: "agent-1-uuid" },
    { order: 2, agent_id: "agent-2-uuid" }
  ]
}

const result = await runPipeline(pipeline.id, ["Test message"], userId)
// result.results.length === 2
// result.totalCost === sum of both agents
```

### Validação de Schema

```typescript
const validated = pipelineSchema.parse(data)
// Garante estrutura correta
```

---

**Status:** ✅ 100% Completo
