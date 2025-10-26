import OpenAI from 'openai'
import { GoogleGenerativeAI } from '@google/generative-ai'

interface LLMCallOptions {
  provider: string
  model: string
  messages: Array<{ role: string; content: string }>
  stream?: boolean
}

interface LLMResponse {
  provider: string
  model: string
  content: string
  latency: number
  cost: number
  stream?: ReadableStream
}

// Preços por 1000 tokens (aproximados)
const PRICING: Record<string, number> = {
  // Modelos atuais
  'openai:gpt-5-nano': 0.0025,
  'google:gemini-2.5-flash': 0.002,
  
  // Modelos futuros - descomente quando disponíveis
  // 'openai:gpt-5-turbo': 5.0,
  // 'openai:gpt-5-vision': 10.0,
  // 'google:gemini-2.5-pro': 1.25,
}

function estimateTokens(text: string): number {
  // Estimativa simples: ~4 caracteres por token
  return Math.ceil(text.length / 4)
}

export async function callLLM({
  provider,
  model,
  messages,
  stream = true,
}: LLMCallOptions): Promise<LLMResponse> {
  const startTime = Date.now()

  try {
    switch (provider.toLowerCase()) {
      case 'openai':
        return await callOpenAI(model, messages, stream, startTime)
      
      case 'google':
        return await callGemini(model, messages, stream, startTime)
      
      default:
        throw new Error(`Provedor não suportado: ${provider}`)
    }
  } catch (error: any) {
    console.error(`Erro ao chamar ${provider}:`, error)
    throw new Error(`Erro ao chamar ${provider}: ${error.message}`)
  }
}

async function callOpenAI(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY não configurado')
  }

  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  })

  // Converter mensagens para formato OpenAI
  const formattedMessages = messages.map((msg) => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }))

  const completion = await openai.chat.completions.create({
    model,
    messages: formattedMessages as any,
    stream,
    temperature: 0.7,
  })

  const latency = Date.now() - startTime

  if (stream) {
    // Retornar stream
    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of completion as any) {
            const content = chunk.choices[0]?.delta?.content || ''
            if (content) {
              controller.enqueue(encoder.encode(content))
            }
          }
        } catch (error) {
          console.error('Erro no stream OpenAI:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return {
      provider: 'OpenAI',
      model,
      content: '',
      latency,
      cost: 0, // Será calculado depois com base no tamanho final
      stream: readable,
    }
  } else {
    // Resposta completa
    const content = (completion as any).choices[0]?.message?.content || ''
    const tokens = estimateTokens(content)
    const cost = (tokens / 1000) * (PRICING[`openai:${model}`] || 0)

    return {
      provider: 'OpenAI',
      model,
      content,
      latency,
      cost,
    }
  }
}

async function callGemini(
  model: string,
  messages: Array<{ role: string; content: string }>,
  stream: boolean,
  startTime: number
): Promise<LLMResponse> {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY não configurado')
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  const geminiModel = genAI.getGenerativeModel({ model })

  // Converter mensagens para formato Gemini
  const history = messages.slice(0, -1).map((msg) => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }))

  const currentMessage = messages[messages.length - 1].content

  if (stream) {
    // Stream mode
    const chat = geminiModel.startChat({ history: history as any })
    const result = await chat.sendMessageStream(currentMessage)

    const encoder = new TextEncoder()
    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text()
            if (text) {
              controller.enqueue(encoder.encode(text))
            }
          }
        } catch (error) {
          console.error('Erro no stream Gemini:', error)
          controller.error(error)
        } finally {
          controller.close()
        }
      },
    })

    return {
      provider: 'Google',
      model,
      content: '',
      latency: 0, // Será calculado depois
      cost: 0,
      stream: readable,
    }
  } else {
    // Non-stream mode
    const chat = geminiModel.startChat({ history: history as any })
    const result = await chat.sendMessage(currentMessage)
    const response = await result.response
    const content = response.text()

    const latency = Date.now() - startTime
    const tokens = estimateTokens(content)
    const cost = (tokens / 1000) * (PRICING[`google:${model}`] || 0)

    return {
      provider: 'Google',
      model,
      content,
      latency,
      cost,
    }
  }
}

export { PRICING }
