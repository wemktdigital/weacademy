# 🧪 Plano Detalhado - Implementação de Testes para Pipelines

## 📋 Visão Geral

Este documento detalha o plano completo para implementar testes automatizados para o módulo de Pipelines do Laboratório de IA.

**Status Atual:** ⏳ Parcialmente Implementado  
**Meta:** ✅ 100% de Cobertura

---

## 📊 Análise do Estado Atual

### ✅ Testes Existentes

1. **`src/tests/unit/pipelineRunner.test.ts`**
   - Testes de supervisor review
   - Testes de decisões (approved, changes_requested, escalate_human)
   - Cobertura: ~15% das funcionalidades

2. **`src/tests/integration/pipelineRunSseApi.test.ts`**
   - Testes de autenticação (401)
   - Testes de execução via SSE
   - Testes de validação (400)
   - Cobertura: ~20% das APIs

3. **`src/tests/integration/adminPipelineTestApi.test.ts`**
   - Testes da API de teste de pipelines
   - Cobertura: ~10% das funcionalidades

### ⏳ Testes Faltantes

#### 1. CRUD de Pipelines (Prioridade: 🔴 Alta)
- ✅ Criar pipeline (POST)
- ✅ Listar pipelines (GET)
- ✅ Atualizar pipeline (PUT)
- ✅ Deletar pipeline (DELETE)
- ⏳ Buscar pipeline por ID (GET /:id)

#### 2. Execução de Pipelines (Prioridade: 🔴 Alta)
- ✅ Execução básica via SSE
- ⏳ Execução sequencial (2+ steps)
- ⏳ Execução paralela (steps independentes)
- ⏳ Execução com variáveis
- ⏳ Execução com retry automático
- ⏳ Execução com supervisor

#### 3. Cálculos e Métricas (Prioridade: 🟡 Média)
- ⏳ Cálculo de custo total
- ⏳ Cálculo de latência total
- ⏳ Custo por etapa
- ⏳ Latência por etapa
- ⏳ Comparação de custos entre configurações

#### 4. Logs e Histórico (Prioridade: 🟡 Média)
- ⏳ Salvamento de logs de execução
- ⏳ Recuperação de histórico
- ⏳ Filtros por data/usuário/pipeline
- ⏳ Exportação de logs

#### 5. Features Avançadas (Prioridade: 🟢 Baixa)
- ⏳ Pipeline com condicionais (if/else)
- ⏳ Pipeline com loops
- ⏳ Pipeline com scheduling
- ⏳ Pipeline com versionamento
- ⏳ Pipeline com A/B testing

---

## 🎯 Plano de Implementação

### Fase 1: CRUD Completo (Sprint 1)

**Arquivo:** `src/tests/lab-ia/pipelines.test.ts`

#### 1.1 Criar Pipeline (POST)
```typescript
describe('Pipelines CRUD', () => {
  it('deve criar um pipeline via POST', async () => {
    const pipelineData = {
      name: 'Pipeline de Teste',
      description: 'Descrição do pipeline',
      steps: [
        { order: 1, agent_id: 'agent-1' },
        { order: 2, agent_id: 'agent-2' }
      ],
      active: true,
      draft: false
    }

    const response = await fetch('/api/lab-ia/admin/pipelines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(pipelineData)
    })

    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.name).toBe('Pipeline de Teste')
    expect(data.steps).toHaveLength(2)
  })

  it('deve validar dados obrigatórios ao criar pipeline', async () => {
    // Teste de validação sem name
    // Teste de validação sem steps
    // Teste de validação com steps vazio
  })

  it('deve retornar 401 se não autenticado', async () => {
    // Teste de autenticação
  })

  it('deve retornar 403 se não for admin', async () => {
    // Teste de autorização
  })
})
```

#### 1.2 Listar Pipelines (GET)
```typescript
it('deve listar pipelines via GET', async () => {
  const response = await fetch('/api/lab-ia/admin/pipelines')
  const data = await response.json()

  expect(response.status).toBe(200)
  expect(data.pipelines).toBeInstanceOf(Array)
  expect(data.pagination).toBeDefined()
})

it('deve suportar paginação', async () => {
  // Teste com ?page=1&limit=10
  // Teste com ?page=2&limit=5
})

it('deve filtrar pipelines draft', async () => {
  // Teste com filtro draft
})
```

#### 1.3 Buscar Pipeline por ID (GET /:id)
```typescript
it('deve buscar pipeline por ID', async () => {
  // Criar pipeline primeiro
  // Buscar pelo ID
  // Validar dados retornados
})
```

#### 1.4 Atualizar Pipeline (PUT)
```typescript
it('deve atualizar pipeline via PUT', async () => {
  // Criar pipeline
  // Atualizar pipeline
  // Validar mudanças
})

it('deve validar dados ao atualizar', async () => {
  // Testes de validação
})
```

#### 1.5 Deletar Pipeline (DELETE)
```typescript
it('deve deletar pipeline via DELETE', async () => {
  // Criar pipeline
  // Deletar pipeline
  // Verificar que foi deletado
})
```

---

### Fase 2: Execução e Cálculos (Sprint 2)

#### 2.1 Execução Sequencial
```typescript
describe('Execução de Pipeline', () => {
  it('deve executar pipeline sequencialmente', async () => {
    // Mock de agentes
    // Executar pipeline com 2 steps
    // Validar que step 2 recebe output do step 1
  })

  it('deve executar pipeline paralelo quando steps são independentes', async () => {
    // Pipeline com steps paralelos
    // Validar execução simultânea
  })

  it('deve calcular custo total corretamente', async () => {
    // Executar pipeline
    // Somar custos de cada etapa
    // Validar total
  })

  it('deve calcular latência total corretamente', async () => {
    // Executar pipeline
    // Somar latências de cada etapa
    // Validar total
  })
})
```

#### 2.2 Execução com Variáveis
```typescript
it('deve substituir variáveis no contexto', async () => {
  // Pipeline com {{variavel}}
  // Executar com contexto
  // Validar substituição
})
```

#### 2.3 Execução com Retry
```typescript
it('deve fazer retry automático em caso de falha', async () => {
  // Mock de falha no primeiro step
  // Validar retry
  // Validar sucesso no retry
})
```

---

### Fase 3: Logs e Histórico (Sprint 3) ✅ COMPLETO

#### 3.1 Salvamento de Logs ✅
- ✅ Salvamento de log de execução no banco
- ✅ Validação de campos obrigatórios
- ✅ Estrutura correta de dados
- ✅ Serialização de input_messages e output_messages

#### 3.2 Recuperação de Histórico ✅
- ✅ Listagem de histórico de execuções
- ✅ Paginação de histórico
- ✅ Filtro por pipeline ID
- ✅ Filtro por range de datas
- ✅ Filtro por usuário (admin only)
- ✅ Busca por palavra-chave
- ✅ Validação de autenticação
- ✅ Tratamento de logs vazios

#### 3.3 Exportação de Logs ✅
- ✅ Exportação como JSON
- ✅ Exportação como Markdown
- ✅ Inclusão de todos os campos

#### 3.4 Estatísticas ✅
- ✅ Cálculo de total de execuções
- ✅ Cálculo de custo total
- ✅ Cálculo de custo médio
- ✅ Pipeline mais usado
- ✅ Latência média

**Total de Testes Implementados:** 29 casos de teste

---

### Fase 4: Features Avançadas (Sprint 4)

#### 4.1 Supervisor Review
```typescript
// Já implementado em pipelineRunner.test.ts
// Expandir com mais casos
```

#### 4.2 Condicionais e Loops
```typescript
it('deve executar branch condicional corretamente', async () => {
  // Pipeline com if/else
  // Validar branch escolhido
})
```

---

## 📁 Estrutura de Arquivos

```
src/tests/
├── lab-ia/
│   ├── pipelines.test.ts          # ✅ CRUD completo (13 testes)
│   ├── pipelines.execution.test.ts # ✅ Execução e cálculos (18 testes)
│   ├── pipelines.logs.test.ts     # ✅ Logs e histórico (29 testes)
│   └── pipelines.advanced.test.ts # ⏳ Features avançadas (pendente)
├── unit/
│   └── pipelineRunner.test.ts     # ✅ Supervisor review (3 testes)
├── integration/
│   ├── pipelineRunSseApi.test.ts  # ✅ API SSE (3 testes)
│   └── adminPipelineTestApi.test.ts # ✅ API de teste (testes existentes)
└── utils/
    └── pipelineFixtures.ts        # ✅ Helpers expandidos
```

---

## 🎯 Priorização

### 🔴 Alta Prioridade ✅ COMPLETO
1. **CRUD Completo** ✅
   - ✅ Criar, Listar, Buscar, Atualizar, Deletar
   - **Status:** 13 testes implementados

2. **Execução Básica** ✅
   - ✅ Execução sequencial e paralela
   - ✅ Cálculo de custo/latência
   - ✅ Variáveis e retry
   - **Status:** 18 testes implementados

### 🟡 Média Prioridade ✅ COMPLETO
3. **Logs e Histórico** ✅
   - ✅ Salvamento e recuperação
   - ✅ Filtros e paginação
   - ✅ Exportação e estatísticas
   - **Status:** 29 testes implementados

### 🟢 Baixa Prioridade (Opcional)
4. **Features Avançadas** ⏳
   - ⏳ Condicionais, loops, scheduling
   - ⏳ Testes de integração end-to-end
   - **Status:** Pendente (prioridade baixa)

---

## 📊 Métricas de Sucesso

### Cobertura Alvo
- **CRUD**: ✅ 100% de cobertura (13/13 testes)
- **Execução**: ✅ ~100% de cobertura (18/18 testes planejados)
- **Logs**: ✅ ~100% de cobertura (29/29 testes implementados)
- **Features Avançadas**: ⏳ Pendente (prioridade baixa)

### Casos de Teste Implementados
- ✅ **Fase 1 (CRUD)**: 13 casos de teste
- ✅ **Fase 2 (Execução)**: 18 casos de teste
- ✅ **Fase 3 (Logs)**: 29 casos de teste
- ⏳ **Fase 4 (Avançado)**: 0 casos (pendente)

**Total Implementado:** 60 casos de teste ✅
**Total Esperado Original:** ~60-80 casos de teste
**Progresso:** ~75-100% do plano básico completo ✅

---

## 🚀 Próximos Passos Imediatos

1. ✅ Criar `src/tests/lab-ia/pipelines.test.ts` com CRUD básico
2. ✅ Expandir `pipelineFixtures.ts` com mais helpers
3. ✅ Implementar testes de execução
4. ✅ Implementar testes de logs
5. ✅ Atualizar documentação (`TESTING_LAB_IA.md`)

## ✅ Status Atual

**Fases Completas:**
- ✅ Fase 1: CRUD Completo (13 testes)
- ✅ Fase 2: Execução e Cálculos (18 testes)
- ✅ Fase 3: Logs e Histórico (29 testes)

**Total:** 60 casos de teste implementados

**Fases Pendentes:**
- ⏳ Fase 4: Features Avançadas (prioridade baixa)
  - Condicionais e loops
  - Testes de integração end-to-end
  - Expandir testes de supervisor

---

## 📝 Notas de Implementação

### Mocking Necessário
- Supabase (client e queries)
- LLM Router (callLLM)
- RAG Service (se aplicável)
- Fetch API para requisições HTTP

### Fixtures e Helpers
- `createPipelineStep()` - ✅ Existe
- `createPipelineRecord()` - ✅ Existe
- `createPipelineExecution()` - ⏳ Criar
- `mockPipelineExecution()` - ⏳ Criar
- `createPipelineLog()` - ⏳ Criar

### Padrões a Seguir
- Usar mesmo padrão dos testes de `agents.test.ts`
- Mockar todas as dependências externas
- Testes isolados (sem dependências entre testes)
- Nomes descritivos para casos de teste

---

**Última atualização:** Novembro 2024  
**Mantenedor:** WE Academy Development Team

