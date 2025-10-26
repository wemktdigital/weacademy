# 🧠 Sprint 9 - Agentes Autônomos com Memória Longa

**Data:** Janeiro 2025  
**Autor:** WE Academy Development Team

## 📋 Visão Geral

Este sprint implementa sistema de **memória de longo prazo** para agentes, permitindo que eles lembrem preferências, contextos e informações importantes do usuário ao longo do tempo. Tudo persistido no Supabase, sem necessidade de Redis.

## 🎯 Objetivos Alcançados

✅ **Tabelas de Memória**: `lab_agent_memory` e `lab_conversation_summaries`  
✅ **Sistema de Memória**: Serviços para salvar, recuperar e gerenciar memórias  
✅ **Resumo de Conversas**: Geração automática de resumos episódicos  
✅ **Proteção PHI**: Detecção e sanitização de dados sensíveis  
✅ **UI de Gerenciamento**: Página para visualizar e deletar memórias  
✅ **APIs REST**: CRUD completo de memórias  

## 📦 Arquivos Criados

### Database

- `supabase/migrations/20251026180000_lab_memory.sql` - Tabelas de memória e resumos

### Serviços

- `src/modules/laboratorio-ia/services/memory.ts` - Gerenciamento de memória
- `src/modules/laboratorio-ia/services/summary.ts` - Resumo de conversas

### APIs

- `src/app/api/lab-ia/memory/route.ts` - GET e DELETE (limpar todas)
- `src/app/api/lab-ia/memory/[key]/route.ts` - DELETE individual

### Frontend

- `src/app/ai-lab/memory/page.tsx` - Página de gerenciamento
- `docs/README_SPRINT9.md` - Esta documentação

## 🗄️ Banco de Dados

### Tabela `lab_agent_memory`

```sql
CREATE TABLE lab_agent_memory (
  id BIGINT PRIMARY KEY,
  user_id UUID,
  agent_id TEXT,  -- null = memória global
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  importance INTEGER (1-5),
  updated_at TIMESTAMPTZ,
  UNIQUE(user_id, agent_id, key)
);
```

**Tipos de Memória:**
- **Global** (`agent_id = null`): Preferências do usuário em geral
- **Específica** (`agent_id = 'xxx'`): Memórias de um agente específico

**Exemplos:**
```sql
-- Memória global
INSERT INTO lab_agent_memory VALUES (
  'user123', NULL, 'especialidade_medica', 'Cardiologia', 5
);

-- Memória do agente
INSERT INTO lab_agent_memory VALUES (
  'user123', 'agent-abc', 'preferencia_formato', 'resumo_breve', 3
);
```

### Tabela `lab_conversation_summaries`

```sql
CREATE TABLE lab_conversation_summaries (
  id BIGINT PRIMARY KEY,
  conversation_id UUID,
  user_id UUID,
  agent_id TEXT,
  summary TEXT,
  tokens_est INTEGER,
  created_at TIMESTAMPTZ
);
```

**Política de Retenção:**
- Manter últimos 5 resumos por conversa
- Função `cleanup_old_summaries()` remove resumos antigos automaticamente

## 🔧 Funcionalidades

### 1. Sistema de Memória

**remember()**: Salva ou atualiza uma memória
```typescript
await remember({
  userId: 'user123',
  agentId: 'agent-abc', // ou null para global
  key: 'especialidade_medica',
  value: 'Cardiologia',
  importance: 5
})
```

**recallProfile()**: Recupera todas as memórias relevantes
```typescript
const profile = await recallProfile({
  userId: 'user123',
  agentId: 'agent-abc'
})
// Retorna: { global: [...], agent: [...] }
```

**forget()**: Deleta uma memória específica
```typescript
await forget({
  userId: 'user123',
  key: 'especialidade_medica',
  agentId: null
})
```

### 2. Resumo de Conversas

**summarizeConversation()**: Gera resumo usando LLM
```typescript
const summary = await summarizeConversation({
  conversationId: 'conv-123',
  userId: 'user123',
  agentId: 'agent-abc',
  messages: [...]
})
```

**shouldSummarize()**: Detecta se deve criar resumo (≥10 mensagens)

### 3. Proteção PHI

**containsPHI()**: Detecta informações sensíveis
```typescript
if (containsPHI(text)) {
  // Não salvar na memória
  console.warn('Dados sensíveis detectados')
}
```

**sanitizePHI()**: Remove ou mascara PHI
```typescript
const clean = sanitizePHI('CPF: 123.456.789-00')
// Retorna: 'CPF: [CPF]'
```

## 🎨 UI/UX

### Página de Gerenciamento

**Características:**
- Separação entre memórias globais e por agente
- Badges de importância (Crítica, Alta, Média, Baixa)
- Timestamp de atualização
- Botões de exclusão individual
- Limpar todas as memórias

**Fluxo:**
1. Usuário acessa `/ai-lab/memory`
2. Vê memórias organizadas por tipo
3. Pode deletar individualmente ou tudo
4. Confirmação antes de excluir

## 🔐 Segurança e Compliance

### Proteções Implementadas

1. **Detecção de PHI**
   - Regex para CPF, telefone, email, nomes
   - Bloqueia salvamento automático

2. **Sanitização**
   - Remove ou mascara dados sensíveis
   - Usado antes de salvar na memória

3. **RLS**
   - Usuário só vê suas próprias memórias
   - Isolamento completo entre usuários

4. **Opt-out**
   - Flag `allow_memory` por conversa (estrutura pronta)
   - Usuário controla quando usar memória

## 🚀 Integração com Agentes

### Injeção de Memória no System Prompt

```typescript
// Antes de chamar o LLM
const profile = await recallProfile({ userId, agentId })
const summaries = await getRecentSummaries({ userId, agentId, conversationId })

const systemPrompt = `
[Memória Global]
${profile.global.map(m => `- ${m.key}: ${m.value}`).join('\n')}

[Memória do Agente]
${profile.agent.map(m => `- ${m.key}: ${m.value}`).join('\n')}

[Resumos Recentes]
${summaries.map(s => `- ${s}`).join('\n')}

Você é um assistente médico especializado...
`
```

### Extração Automática

```typescript
// Após resposta do LLM
const facts = extractFacts(messages)
for (const fact of facts) {
  await remember({
    userId,
    agentId,
    ...fact
  })
}
```

## 📊 Exemplos de Uso

### Caso 1: Especialidade Médica

```typescript
// Usuário menciona especialidade
// Sistema detecta e salva
await remember({
  userId: 'user123',
  agentId: null, // global
  key: 'especialidade_medica',
  value: 'Cardiologia',
  importance: 5
})

// Em próximas conversas, o agente já sabe
// "Como especialista em Cardiologia, você pode..."
```

### Caso 2: Preferências de Formato

```typescript
// Usuário pede "resumos breves"
await remember({
  userId: 'user123',
  agentId: 'agent-resumo',
  key: 'preferencia_formato',
  value: 'breve',
  importance: 3
})

// Agente sempre fornece resumos curtos
```

### Caso 3: Resumo de Conversa Longa

```typescript
// Após 15 mensagens na conversa
if (shouldSummarize(messages)) {
  const summary = await summarizeConversation({
    conversationId,
    userId,
    agentId,
    messages
  })
  // Salvo em lab_conversation_summaries
}

// Em conversa futura, o agente tem contexto
```

## 🧪 Testes

### Teste de Memória

```typescript
// Salvar
await remember({
  userId: 'test-user',
  key: 'test_key',
  value: 'test_value'
})

// Recuperar
const profile = await recallProfile({ userId: 'test-user' })
console.assert(profile.global.some(m => m.key === 'test_key'))

// Deletar
await forget({ userId: 'test-user', key: 'test_key' })
```

### Teste de PHI

```typescript
const hasPHI = containsPHI('CPF: 123.456.789-00')
console.assert(hasPHI === true)

const clean = sanitizePHI('CPF: 123.456.789-00')
console.assert(clean === 'CPF: [CPF]')
```

## 📈 Melhorias Futuras

- [ ] Editor visual de memórias
- [ ] Busca semântica usando embeddings
- [ ] Importância automática baseada em uso
- [ ] Export/import de memórias
- [ ] Métricas de personalização
- [ ] Compartilhamento de memórias (opcional)
- [ ] Machine learning para extração de fatos

---

**Status:** ✅ 100% Completo
