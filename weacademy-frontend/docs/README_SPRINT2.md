# 🚀 Sprint 2 - Multiprovedor LLM & Seleção de Modelos

## 📋 Visão Geral

Este sprint implementa suporte a múltiplos provedores de LLM, permitindo que usuários escolham entre diferentes modelos da OpenAI e Google Gemini.

## 🎯 Objetivos Alcançados

✅ **ModelSelector Component**: Dropdown com seleção de provedor e modelo  
✅ **LLM Router Service**: Serviço unificado para roteamento de requisições  
✅ **Suporte a OpenAI**: GPT-4o Mini, GPT-4o, GPT-3.5 Turbo  
✅ **Suporte a Google Gemini**: Gemini 1.5 Flash, Gemini 1.5 Pro  
✅ **Persistência de Preferências**: LocalStorage + Supabase  
✅ **Streaming Unificado**: Mesma interface para todos os provedores  

## 🏗️ Arquitetura

### Componentes Criados

#### 1. ModelSelector (`src/modules/laboratorio-ia/components/ModelSelector.tsx`)
- Dropdown com lista de modelos disponíveis
- Ícones por provedor (🤖 OpenAI, ✨ Google)
- Persiste seleção em localStorage
- Toast notification ao mudar modelo

#### 2. LLM Router Service (`src/modules/laboratorio-ia/services/llmRouter.ts`)
- Função principal: `callLLM(options)`
- Roteamento baseado em provedor
- Suporte a streaming e non-streaming
- Cálculo de custo e latência

### Provedores Suportados

| Provedor | Modelos | API Key |
|----------|---------|---------|
| OpenAI | GPT-5 Nano | `OPENAI_API_KEY` |
| Google | Gemini 2.5 Flash | `GEMINI_API_KEY` |

### Preços (tabela centralizada)

Mantemos todos os valores de referência no arquivo `src/modules/laboratorio-ia/config/pricing.ts`, em dólar por 1M tokens (ou custo equivalente quando o provedor cobra por execução).

```typescript
import { MODEL_PRICING } from '@/modules/laboratorio-ia/config/pricing'

const pricing = MODEL_PRICING['openai:gpt-4o-mini'] // { input: 0.15, output: 0.60 }
```

> Observação: para modelos que cobram por execução (ex.: geração de vídeo no Replicate) normalizamos para a mesma estrutura `{ input, output }`, registrando comentários adicionais em `notes`.

## 🔧 Configuração

### 1. Variáveis de Ambiente

Adicione ao `.env.local`:

```bash
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=...
```

### 2. Migration do Banco

A tabela `lab_user_settings` foi criada para armazenar preferências:

```sql
CREATE TABLE lab_user_settings (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  preferred_provider TEXT,
  preferred_model TEXT,
  temperature NUMERIC DEFAULT 1.0,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

## 📡 API Endpoints

### POST `/api/lab-ia/chat`

**Payload:**
```json
{
  "messages": [
    { "role": "user", "content": "Olá" }
  ],
  "provider": "OpenAI",
  "model": "gpt-4o-mini"
}
```

**Response:** Stream de texto (SSE)

## 🔄 Fluxo de Uso

1. Usuário seleciona modelo no dropdown
2. ModelSelector persiste em localStorage
3. Ao enviar mensagem, API usa `callLLM()`
4. Router identifica provedor e chama SDK correto
5. Resposta stream é retornada ao cliente

## 🚀 Adicionando Novos Modelos

Para adicionar um novo modelo:

### 1. Adicione ao ModelSelector

```typescript
const MODELS: Model[] = [
  // ... modelos existentes
  {
    provider: 'NovoProvedor',
    model: 'novo-modelo',
    displayName: 'Novo Modelo',
    icon: '🎯',
  },
]
```

### 2. Adicione Preço

```typescript
const PRICING = {
  // ... preços existentes
  'novoproveedor:novo-modelo': 0.50,
}
```

### 3. Implemente no Router

```typescript
case 'novoproveedor':
  return await callNovoProvedor(model, messages, stream, startTime)
```

## 📊 Estrutura de Resposta do LLM Router

```typescript
interface LLMResponse {
  provider: string        // 'OpenAI' | 'Google'
  model: string          // 'gpt-4o-mini' | 'gemini-1.5-flash'
  content: string        // Resposta completa (non-stream)
  latency: number        // Milissegundos
  cost: number           // USD estimado
  stream?: ReadableStream // Stream (se stream=true)
}
```

## 🎨 UI/UX

- ✅ Dropdown elegante no header
- ✅ Ícones por provedor
- ✅ Toast ao mudar modelo
- ✅ Persistência entre sessões
- ✅ Responsivo mobile
- ✅ Dark mode

## 🔒 Segurança

- Row Level Security (RLS) na tabela `lab_user_settings`
- API keys apenas no servidor (variáveis de ambiente)
- Validação de mensagens antes do envio
- Rate limiting automático dos provedores

## 🐛 Troubleshooting

### Erro: "OPENAI_API_KEY não configurado"
- Adicione a chave no `.env.local`
- Reinicie o servidor de desenvolvimento

### Erro: "GEMINI_API_KEY não configurado"
- Adicione a chave no `.env.local`
- Reinicie o servidor de desenvolvimento

### Modelo não aparece no dropdown
- Verifique se foi adicionado ao array `MODELS`
- Verifique se o componente foi renderizado

## 📈 Próximos Passos (Sprint 3+)

- [ ] Implementar log de uso no Supabase
- [ ] Dashboard de métricas
- [ ] Agentes especializados
- [ ] Suporte a upload de arquivos
- [ ] Cache de respostas

## 📝 Notas

- Streaming funciona com ambos os provedores
- Custos são estimados (baseado em tokens)
- Latência inclui tempo de rede + processamento
- Modelos podem ter limitações de taxa

### Adicionando Novos Modelos

Para adicionar novos modelos no futuro:
1. Adicione ao array `MODELS` no `ModelSelector`
2. Adicione o preço no `PRICING` do `llmRouter`
3. A arquitetura já está preparada para expansão automática

---

**Status:** ✅ 100% Completo  
**Data:** Janeiro 2025  
**Autor:** WE Academy Development Team
