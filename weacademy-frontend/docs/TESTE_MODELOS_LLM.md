# 🧪 Guia de Teste de Modelos LLM

Este guia explica como usar o script automatizado para testar todos os modelos LLM disponíveis no Laboratório de IA.

## 📋 Pré-requisitos

1. **Servidor rodando**: O servidor Next.js deve estar rodando em `http://localhost:3000`
2. **Usuário autenticado**: Você precisa estar logado no sistema (não pode ser guest)
3. **Token de autenticação**: Você precisa obter o token de acesso do Supabase

## 🔑 Como Obter o Token de Autenticação

### Método 1: Via Console do Navegador (Recomendado)

1. Faça login no sistema em `http://localhost:3000`
2. Abra o console do navegador (F12)
3. Execute o seguinte código:

```javascript
// No console do navegador
const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
const supabase = createClient(
  'SUA_URL_DO_SUPABASE',
  'SUA_CHAVE_ANON_DO_SUPABASE'
)
const { data } = await supabase.auth.getSession()
console.log('Token:', data.session?.access_token)
```

Ou, se você já tem o Supabase disponível globalmente:

```javascript
const { data } = await supabase.auth.getSession()
console.log(data.session?.access_token)
```

4. Copie o token exibido

### Método 2: Via localStorage

No console do navegador:

```javascript
// Verificar tokens armazenados
Object.keys(localStorage).filter(k => k.includes('token') || k.includes('auth'))
```

## 🚀 Como Executar o Teste

### Opção 1: Usando npm script (Recomendado)

```bash
# Definir o token como variável de ambiente
export TEST_AUTH_TOKEN="seu-token-aqui"

# Executar o teste
npm run test:llm-models
```

### Opção 2: Usando npx tsx diretamente

```bash
# Com token inline
TEST_AUTH_TOKEN="seu-token-aqui" npx tsx scripts/test-all-llm-models.ts

# Ou definir antes
export TEST_AUTH_TOKEN="seu-token-aqui"
npx tsx scripts/test-all-llm-models.ts
```

## ⚙️ Opções de Configuração

O script aceita as seguintes variáveis de ambiente:

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `TEST_AUTH_TOKEN` | Token de autenticação (obrigatório) | - |
| `TEST_BASE_URL` | URL base da API | `http://localhost:3000` |
| `TEST_MESSAGE` | Mensagem personalizada para teste | `"Responda apenas com 'OK' se você está funcionando corretamente."` |
| `TEST_DELAY` | Delay entre testes (ms) | `1000` |
| `TEST_INCLUDE_VIDEO` | Incluir modelos de vídeo (`true`/`false`) | `false` |

### Exemplos de Uso

```bash
# Teste básico
TEST_AUTH_TOKEN="token" npm run test:llm-models

# Teste com mensagem personalizada
TEST_AUTH_TOKEN="token" TEST_MESSAGE="Olá, como você está?" npm run test:llm-models

# Teste incluindo modelos de vídeo (mais lento)
TEST_AUTH_TOKEN="token" TEST_INCLUDE_VIDEO=true npm run test:llm-models

# Teste com delay maior entre requisições
TEST_AUTH_TOKEN="token" TEST_DELAY=2000 npm run test:llm-models

# Teste em ambiente diferente
TEST_AUTH_TOKEN="token" TEST_BASE_URL="https://staging.example.com" npm run test:llm-models
```

## 📊 O Que o Script Testa

O script testa automaticamente:

1. ✅ **Todos os modelos de texto disponíveis**:
   - OpenAI: GPT-5, GPT-5 Mini, GPT-5 Nano
   - Google: Gemini 2.5 Flash, Gemini 2.5 Pro, Gemini 2.5 Flash Lite, Gemini 2.5 Flash Image
   - DeepSeek: DeepSeek Chat, DeepSeek Reasoner
   - Grok: Grok-4 Fast, Grok-4 Fast Reasoning
   - Anthropic: Claude Sonnet 4.5, Claude Haiku 4.5, Claude Opus 4.1
   - Replicate: Llama 3.1 405B Instruct

2. ⏭️ **Modelos de vídeo são pulados por padrão** (use `TEST_INCLUDE_VIDEO=true` para incluir)

## 📈 Relatórios Gerados

O script gera dois tipos de relatórios:

### 1. Relatório JSON (`test-reports/llm-models-test-YYYY-MM-DDTHH-MM-SS.json`)

Contém dados estruturados com:
- Timestamp do teste
- Resumo estatístico
- Resultados detalhados de cada modelo
- Latência, erros, previews de resposta

### 2. Relatório Texto (`test-reports/llm-models-test-YYYY-MM-DDTHH-MM-SS.txt`)

Relatório legível em texto com:
- Estatísticas gerais
- Lista de sucessos e falhas
- Detalhes de cada modelo testado

## 📝 Exemplo de Saída

```
🧪 Iniciando testes de todos os modelos LLM...

📡 URL base: http://localhost:3000
📊 Total de modelos disponíveis: 16

⏭️  Pulando modelos de vídeo (use skipVideoModels=false para incluir)

📋 Modelos a testar: 14

======================================================================

[1/14] ⏳ Testando GPT-5 (OpenAI)...
   ✅ Sucesso! Latência: 1234ms
   📝 Preview: OK, estou funcionando corretamente...

[2/14] ⏳ Testando Gemini 2.5 Flash (Google)...
   ✅ Sucesso! Latência: 856ms
   📝 Preview: OK

...

======================================================================
📊 RELATÓRIO FINAL
======================================================================

✅ Sucesso: 12/14 (86%)
❌ Falhas: 2/14 (14%)

📈 Latência:
   Média: 1200ms
   Mínima: 450ms
   Máxima: 3500ms

❌ Modelos com falha:
   - Grok-4 Fast Reasoning (Grok/grok-4-fast-reasoning)
     Erro: API key não configurada
   - Llama 3.1 405B Instruct (Replicate/meta/meta-llama-3.1-405b-instruct)
     Erro: Timeout após 30s

📦 Resultados por Provider:
   OpenAI: 3/3 sucesso
   Google: 4/4 sucesso
   DeepSeek: 2/2 sucesso
   Grok: 1/2 sucesso
   Anthropic: 3/3 sucesso
   Replicate: 0/1 sucesso

💾 Relatório JSON salvo em: test-reports/llm-models-test-2025-01-26T10-30-45.json
📄 Relatório texto salvo em: test-reports/llm-models-test-2025-01-26T10-30-45.txt
```

## 🔍 Troubleshooting

### Erro: "TEST_AUTH_TOKEN não configurado"

**Solução**: Defina a variável de ambiente antes de executar:
```bash
export TEST_AUTH_TOKEN="seu-token"
npm run test:llm-models
```

### Erro: "Não autenticado" ou HTTP 401

**Causa**: Token inválido ou expirado

**Solução**: 
1. Obtenha um novo token seguindo o método acima
2. Verifique se o token não expirou (tokens expiram após algum tempo)
3. Certifique-se de estar logado no sistema

### Erro: "ECONNREFUSED" ou "fetch failed"

**Causa**: Servidor não está rodando

**Solução**: 
1. Certifique-se de que o servidor está rodando em `http://localhost:3000`
2. Ou defina `TEST_BASE_URL` para a URL correta

### Alguns modelos falham com "API key não configurada"

**Causa**: Variáveis de ambiente não configuradas

**Solução**: Verifique se todas as API keys estão configuradas no `.env.local`:
- `OPENAI_API_KEY`
- `GEMINI_API_KEY`
- `DEEPSEEK_API_KEY`
- `XAI_API_KEY` (para Grok)
- `ANTHROPIC_API_KEY`
- `REPLICATE_API_TOKEN`

### Modelos de vídeo demoram muito ou falham

**Causa**: Modelos de vídeo são mais lentos e podem ter limites diferentes

**Solução**: 
- Por padrão, modelos de vídeo são pulados
- Se quiser testá-los, use `TEST_INCLUDE_VIDEO=true`
- Aumente o `TEST_DELAY` para dar mais tempo entre requisições

## 🎯 Próximos Passos

Após executar os testes:

1. **Revise os relatórios** em `test-reports/`
2. **Corrija problemas** identificados (API keys, configurações, etc.)
3. **Execute novamente** para validar correções
4. **Documente problemas conhecidos** se algum modelo não estiver disponível

## 📚 Modelos Testados

Consulte `src/modules/laboratorio-ia/config/models.ts` para ver a lista completa de modelos disponíveis.

