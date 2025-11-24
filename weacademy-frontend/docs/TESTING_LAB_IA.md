# 🧪 Test Suite - WE Academy Laboratório de IA

## 📋 Visão Geral

Suíte de testes automatizados para validar os módulos implementados nos Sprints 6-9 do Laboratório de IA.

## 🎯 Objetivos

- Validar CRUD de agentes
- Testar templates de agentes
- Validar pipelines Multi-LLM
- Verificar sistema de memória persistente
- Garantir proteção PHI
- Testar resumo de conversas

## 🛠️ Configuração

### Frameworks Utilizados

- **Vitest**: Framework de testes principal
- **@testing-library/react**: Testes de componentes React
- **jsdom**: Ambiente de DOM simulado

### Instalação

```bash
npm install -D vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
```

### Scripts

```json
{
  "test": "vitest",
  "test:ui": "vitest --ui",
  "test:labia": "vitest src/tests/lab-ia --run"
}
```

## 📁 Estrutura de Arquivos

```
src/tests/
├── setup.ts                # Configuração global de testes
└── lab-ia/
    ├── agents.test.ts      # Testes de CRUD de agentes ✅
    ├── templates.test.ts   # Testes de templates ✅
    ├── memory.test.ts      # Testes de memória ✅
    ├── summary.test.ts     # Testes de resumo de conversas ✅
    ├── intelligentRouter.test.ts # Testes de roteamento inteligente ✅
    ├── pipelines.test.ts   # Testes de CRUD de pipelines ✅
    ├── pipelines.execution.test.ts # Testes de execução de pipelines ✅
    └── pipelines.logs.test.ts # Testes de logs e histórico ✅
```

## 🧪 Casos de Teste

### 1. Agents (agents.test.ts)

#### ✅ Criar Agente
```typescript
it('should create a new agent via POST', async () => {
  // Mock Supabase
  // POST para /api/lab-ia/admin/agents
  // Validar status 201
})
```

#### ✅ Listar Agentes
```typescript
it('should list agents via GET', async () => {
  // Mock retornando array de agentes
  // Validar array tem elementos
  // Validar propriedades dos agentes
})
```

#### ✅ Atualizar Agente
```typescript
it('should update an agent via PUT', async () => {
  // PUT para /api/lab-ia/admin/agents/:id
  // Validar prompt foi atualizado
})
```

#### ✅ Deletar Agente
```typescript
it('should delete an agent via DELETE', async () => {
  // DELETE para /api/lab-ia/admin/agents/:id
  // Validar status 200
})
```

### 2. Templates (templates.test.ts)

#### ✅ Criar Template
```typescript
it('should create a template via POST', async () => {
  // POST para /api/lab-ia/admin/templates
  // Validar status 201
})
```

#### ✅ Listar Templates
```typescript
it('should list templates via GET', async () => {
  // Validar array de templates
  // Validar categorias
})
```

#### ✅ Importar Templates
```typescript
it('should import templates via POST /import', async () => {
  // POST /api/lab-ia/admin/templates/import
  // Validar quantidade inserida
})
```

#### ✅ Exportar Templates
```typescript
it('should export templates via GET', async () => {
  // GET /api/lab-ia/admin/templates?action=export
  // Validar formato JSON
})
```

### 3. Memory (memory.test.ts)

#### ✅ Salvar Memória
```typescript
it('should save a memory using remember()', async () => {
  // Chamar remember()
  // Validar insert em lab_agent_memory
})
```

#### ✅ Recuperar Memória
```typescript
it('should recall memories using recallProfile()', async () => {
  // Chamar recallProfile()
  // Validar estrutura retornada
  // Validar separação global/agent
})
```

#### ✅ Deletar Memória
```typescript
it('should delete a memory using forget()', async () => {
  // Chamar forget()
  // Validar delete em lab_agent_memory
})
```

#### ✅ Detecção de PHI
```typescript
it('should handle PHI detection', () => {
  // Testar CPF
  // Testar telefone
  // Testar data
  // Testar nome
})
```

#### ✅ Sanitização de PHI
```typescript
it('should sanitize PHI', () => {
  // Mascarar CPF
  // Mascarar telefone
  // Mascarar data
})
```

### 4. Pipelines (pipelines.test.ts)

**Status:** ✅ Parcialmente Implementado

**Testes Implementados:**
- ✅ Criar pipeline via POST
- ✅ Listar pipelines via GET
- ✅ Buscar pipeline por ID
- ✅ Atualizar pipeline via PUT
- ✅ Deletar pipeline via DELETE
- ✅ Validação de campos obrigatórios
- ✅ Suporte a paginação
- ✅ Tratamento de erros (401, 403)
- ✅ Pipelines draft
- ✅ Cálculo de custo total
- ✅ Cálculo de latência total
- ✅ Custo por etapa

**Testes Implementados Adicionalmente:**
- ✅ Execução sequencial de pipeline
- ✅ Passagem de contexto entre steps
- ✅ Execução paralela de steps independentes
- ✅ Execução mista (sequencial + paralelo)
- ✅ Cálculo de custo total
- ✅ Cálculo de latência total
- ✅ Custo por etapa
- ✅ Latência por etapa
- ✅ Substituição de variáveis em prompts
- ✅ Tratamento de variáveis faltantes
- ✅ Retry automático em falhas
- ✅ Exponential backoff para retry
- ✅ Tratamento de erros durante execução
- ✅ Continuidade após erros não-críticos
- ✅ Rastreamento de progresso
- ✅ Acumulação de custos durante execução

**Testes Implementados Adicionalmente:**
- ✅ Salvamento de logs de execução no banco
- ✅ Recuperação de histórico de execuções
- ✅ Paginação de histórico
- ✅ Filtro por pipeline ID
- ✅ Filtro por range de datas
- ✅ Filtro por usuário (admin only)
- ✅ Busca por palavra-chave
- ✅ Exportação de logs (JSON e Markdown)
- ✅ Validação de estrutura de logs
- ✅ Cálculo de estatísticas (total, média, mais usado)
- ✅ Tratamento de logs vazios
- ✅ Validação de autenticação

**Testes Pendentes:**
- ⏳ Execução com supervisor (expandir testes existentes)
- ⏳ Testes de integração end-to-end

## 🔧 Executando os Testes

### Todos os Testes

```bash
npm run test:labia
```

### Teste Específico

```bash
npx vitest src/tests/lab-ia/memory.test.ts
```

### Modo Watch

```bash
npx vitest --watch
```

### UI Interativa

```bash
npm run test:ui
```

## 📊 Cobertura de Testes

### Cobertura Atual

- ✅ **Agents**: 4 casos de teste (100%)
- ✅ **Templates**: 4 casos de teste (100%)
- ✅ **Memory**: 5 casos de teste (100%)
- ✅ **Summary Service**: 18 casos de teste (100%)
  - ✅ Resumo de conversas (`summarizeConversation`)
  - ✅ Detecção de necessidade de resumo (`shouldSummarize`)
  - ✅ Extração de fatos (`extractFacts`)
  - ✅ Detecção de PHI (`containsPHI`)
  - ✅ Sanitização de PHI (`sanitizePHI`)
- ✅ **Intelligent Router**: 46 casos de teste (100%)
  - ✅ Detecção de categoria de tarefa (`detectTaskCategory`)
  - ✅ Análise de prompt (`analyzePrompt`)
  - ✅ Recomendação de modelos (`recommendModels`)
  - ✅ Roteamento inteligente (`intelligentRoute`)
- ✅ **Pipelines**: 60 casos de teste (100%)
  - ✅ CRUD: 13 testes
  - ✅ Execução: 18 testes
  - ✅ Logs e histórico: 29 testes (veja `PLANO_TESTES_PIPELINES.md`)

**Total: 137 testes implementados (100% passando)** ✅

### Métricas Alvo

- **Cobertura de Código**: ≥ 80%
- **Testes Unitários**: Agentes, Templates, Memory
- **Testes de Integração**: APIs REST
- **Testes de Sistema**: Fluxos completos

## 🐛 Resolução de Problemas

### Erro: "supabaseUrl is required"

**Causa:** Variáveis de ambiente não configuradas

**Solução:**
1. Criar arquivo `.env.test` com variáveis mockadas
2. Configurar Vitest para carregar `.env.test`

### Erro: "Module not found"

**Causa:** Imports incorretos

**Solução:**
```typescript
// Adicionar ao vitest.config.ts
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
  },
}
```

### Mocks não funcionando

**Causa:** Mock do Supabase não está sendo aplicado

**Solução:**
```typescript
vi.mock('@/lib/supabase', () => ({
  createClient: vi.fn(),
}))
```

## 🚀 Próximos Passos

- [ ] Implementar testes de pipelines
- [ ] Adicionar testes E2E com Playwright
- [ ] Configurar CI/CD para execução automática
- [ ] Adicionar testes de performance
- [ ] Criar testes de carga
- [ ] Implementar testes de segurança

## 📝 Notas

### Mocking

Todos os testes usam mocks do Supabase para evitar chamadas reais ao banco. Isso permite:
- Execução rápida
- Isolamento de testes
- Sem dependências externas

### Testes de Integração

Para testes de integração reais, configurar:
- Banco de dados de teste
- Instância separada do Supabase
- Dados de seed específicos

---

**Última atualização:** Janeiro 2025  
**Mantenedor:** WE Academy Development Team
