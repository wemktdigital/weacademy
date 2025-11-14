# Integração com Replicate

Este documento descreve a integração do provedor Replicate com modelos de IA, incluindo o Meta Llama 3.1 405B Instruct.

## Configuração

### 1. Obter Token da API do Replicate

1. Acesse [https://replicate.com](https://replicate.com)
2. Crie uma conta ou faça login
3. Vá em Settings > API Tokens
4. Gere um novo token

### 2. Configurar Variável de Ambiente

Adicione a seguinte variável ao arquivo `.env.local`:

```bash
REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## Modelos Disponíveis

### Meta Llama 3.1 405B Instruct

- **Provedor**: `Replicate`
- **Modelo**: `meta/meta-llama-3.1-405b-instruct`
- **Display Name**: Llama 3.1 405B Instruct
- **Ícone**: 🦙

## Adicionando Novos Modelos do Replicate

Para adicionar novos modelos do Replicate:

1. **Adicionar ao arquivo de configuração** (`src/modules/laboratorio-ia/config/models.ts`):

```typescript
{
  provider: 'Replicate',
  model: 'nome-do-modelo/no-replicate',
  displayName: 'Nome do Modelo',
  icon: '🦙',
}
```

2. **Adicionar preços** (se necessário) em `src/modules/laboratorio-ia/services/llmRouter.ts`:

```typescript
'replicate:nome-do-modelo/no-replicate': { input: 0.0, output: 0.0 },
```

3. **Ajustar parâmetros** na função `callReplicate` se o modelo tiver requisitos específicos:

```typescript
if (model.includes('nome-do-modelo')) {
  input.parametro_especifico = valor
}
```

## Como Funciona

A função `callReplicate`:

1. Converte mensagens para o formato esperado pelo modelo
2. Para modelos Llama, usa o formato de chat do Llama 3.1 com tokens especiais
3. Envia para a API do Replicate
4. Processa a resposta (string, array ou objeto)
5. Retorna no formato padrão do sistema

## Formato de Mensagens

Para modelos Llama, as mensagens são convertidas para o formato:

```
<|start_header_id|>system<|end_header_id|>

{system_message}<|eot_id|>
<|start_header_id|>user<|end_header_id|>

{user_message}<|eot_id|>
<|start_header_id|>assistant<|end_header_id|>

```

## Parâmetros Padrão

Para modelos Llama:
- `max_tokens`: 2048
- `temperature`: 0.7
- `top_p`: 0.9

Estes podem ser ajustados na função `callReplicate` conforme necessário.

## Suporte a Streaming

O Replicate suporta streaming. Quando `stream=true`, a função retorna um `ReadableStream` que pode ser consumido incrementalmente.

## Custo

O Replicate cobra por segundo de execução e recursos usados, não por token. Por isso, os preços no sistema são estimativas baseadas em tokens.

Para modelos grandes como o 405B, o custo pode ser significativo. Recomenda-se monitorar o uso.

## Exemplos de Modelos Disponíveis no Replicate

- `meta/meta-llama-3.1-405b-instruct` - Llama 3.1 405B
- `meta/meta-llama-3.1-70b-instruct` - Llama 3.1 70B
- `meta/meta-llama-3.1-8b-instruct` - Llama 3.1 8B
- Outros modelos podem ser adicionados seguindo o mesmo padrão

## Referências

- [Documentação do Replicate](https://replicate.com/docs)
- [API do Llama 3.1 405B](https://replicate.com/meta/meta-llama-3.1-405b-instruct/api)

