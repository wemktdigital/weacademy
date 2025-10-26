# 🚀 Sprint 4 - Agentes Especializados e Automações

## 📋 Visão Geral

Este sprint implementa um sistema de agentes especializados no Laboratório de IA, permitindo que usuários escolham agentes pré-configurados para tarefas específicas com prompts otimizados.

## 🎯 Objetivos Alcançados

✅ **Registro de Agentes**: Sistema modular de agentes  
✅ **AgentSelector**: Interface de seleção de agentes  
✅ **3 Agentes Implementados**: Resumo de Artigo, Post Instagram, Análise de Ads  
✅ **Logs de Execução**: Tabela `lab_agent_logs`  
✅ **Badge de Agente Ativo**: Indicador visual no header  

## 🏗️ Arquitetura

### Agentes Disponíveis

```typescript
interface Agent {
  id: string
  name: string
  icon: string
  description: string
  prompt: string
  type: 'local' | 'external'
  category?: string
}
```

### Agentes Implementados

1. **🧠 Resumir Artigo Científico**
   - Tipo: `local`
   - Categoria: Pesquisa
   - Extrai insights de artigos médicos
   - Gera resumo em linguagem acessível

2. **📱 Gerar Post Instagram**
   - Tipo: `local`
   - Categoria: Marketing
   - Cria legendas para posts médicos
   - Inclui hashtags e CTAs

3. **📊 Analisar Campanhas Google Ads**
   - Tipo: `local`
   - Categoria: Performance
   - Analisa KPIs de campanhas
   - Sugere otimizações

## 📡 APIs Criadas

### 1. POST `/api/lab-ia/chat` (Atualizada)

**Payload:**
```json
{
  "messages": [...],
  "provider": "OpenAI",
  "model": "gpt-5-nano",
  "agentId": "resumo-artigo"
}
```

**Funcionamento:**
- Se `agentId` fornecido, injeta system prompt do agente
- System prompt inserido no início das mensagens
- Logs de execução salvos em `lab_agent_logs`



## 🗄️ Banco de Dados

### Tabela `lab_agent_logs`

```sql
CREATE TABLE lab_agent_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  latency_ms INTEGER,
  cost_usd NUMERIC(10, 4),
  created_at TIMESTAMPTZ
);
```



## 🎨 UI/UX

### AgentSelector

- Dropdown com lista de agentes
- Ícones e descrições visíveis
- Indicador de tipo (Local/External)
- Badge "Modo Conversação" como padrão
- Botão "Remover" quando agente ativo

### Badge de Agente Ativo

- Exibido no header quando agente selecionado
- Formato: `[ícone] [Nome do Agente]`
- Cor primária com fundo translúcido

### Status "Executando Agente"

- Substitui "Pensando..." quando agente ativo
- Formato: "Executando agente 🧠..."
- Spinner animado

## 🔄 Fluxo de Execução

```
1. Usuário seleciona agente
   ↓
2. Badge aparece no header
   ↓
3. Usuário envia mensagem
   ↓
4. API injeta system prompt do agente
   ↓
5. LLM processa com personalidade do agente
   ↓
6. Log salvo em lab_agent_logs
   ↓
7. Resposta exibida com "Executando agente..."
```

## 🚀 Adicionando Novos Agentes

### 1. Registrar em `agents/index.ts`

```typescript
{
  id: 'novo-agente',
  name: 'Novo Agente',
  icon: '🎯',
  description: 'Descrição do agente',
  prompt: 'Prompt system personalizado...',
  type: 'local', // ou 'external'
  category: 'Categoria',
}
```

### 2. Agente aparecerá automaticamente no selector

- Não é necessário alterar componentes
- Sistema detecta novos agentes automaticamente



## 📊 Estrutura de Dados

### Message com Agent

```typescript
{
  role: 'system',
  content: agent.prompt
}
// ... mensagens do usuário
```

### Log de Agente

```typescript
{
  agent_id: 'resumo-artigo',
  provider: 'OpenAI',
  model: 'gpt-5-nano',
  latency_ms: 1250,
  cost_usd: 0.0025
}
```

## 🔒 Segurança

- RLS aplicado em ambas as tabelas
- Validação de agentId
- Rate limiting automático
- Logs apenas para execuções válidas

## 🐛 Troubleshooting

### Agente não aparece no dropdown

- Verificar se foi adicionado em `agents/index.ts`
- Verificar sintaxe do objeto

### System prompt não aplicado

- Verificar se `agentId` está sendo enviado na requisição
- Verificar logs do console



## 🎯 Exemplos de Uso

### Agente Resumir Artigo

```
Usuário: [cola texto do artigo científico]
Agente: [gera resumo em linguagem acessível]
Log: Salvado em lab_agent_logs
```

### Agente Gerar Post Instagram

```
Usuário: [descreve tema do post]
Agente: [gera legenda completa com hashtags e CTAs]
Log: Salvado em lab_agent_logs
```

## 📈 Próximos Passos

- [ ] Dashboard de uso de agentes
- [ ] Agentes customizáveis pelo usuário
- [ ] Histórico de execuções
- [ ] Templates de prompts
- [ ] Integração com mais plataformas

## 📝 Notas Técnicas

- System prompts não são exibidos ao usuário
- Agentes podem ser facilmente desabilitados
- Custos rastreados por agente
- Todos os agentes são do tipo "local" (execução via LLM apenas)

---

**Status:** ✅ 100% Completo  
**Data:** Janeiro 2025  
**Autor:** WE Academy Development Team
