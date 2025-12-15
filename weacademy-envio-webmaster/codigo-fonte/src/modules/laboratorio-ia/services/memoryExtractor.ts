import { callLLM } from './llmRouter'
import { MemoryItem } from './memory'
import { containsPHI, sanitizePHI } from './summary'

interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

/**
 * Extrai memórias relevantes de uma conversa usando LLM
 */
export async function extractMemoriesFromConversation({
  userId,
  messages,
  existingMemories = [],
}: {
  userId: string
  messages: Message[]
  existingMemories?: MemoryItem[]
}): Promise<MemoryItem[]> {
  try {
    // Analisar últimas mensagens da conversa (últimas 10-15)
    const recentMessages = messages.slice(-15)
    
    if (recentMessages.length === 0) {
      return []
    }

    // Filtrar mensagens do usuário e do assistente (ignorar system)
    const conversationMessages = recentMessages.filter(
      m => m.role === 'user' || m.role === 'assistant'
    )

    if (conversationMessages.length === 0) {
      return []
    }

    // Preparar lista de memórias existentes para contexto
    const existingMemoriesText = existingMemories
      .map(m => `- ${m.key}: ${m.value}`)
      .join('\n')

    // Construir prompt para extração
    const extractionPrompt = `Analise a conversa abaixo e identifique informações importantes sobre o usuário que devem ser lembradas para futuras conversas.

Informações relevantes incluem:
- Nome, apelido, preferências de tratamento
- Profissão, especialidade, área de atuação
- Preferências de estilo (formal/informal)
- Interesses, hobbies
- Objetivos profissionais/pessoais
- Informações contextuais importantes

IMPORTANTE:
- NÃO inclua informações sensíveis (CPF, telefone, endereço completo)
- NÃO inclua informações temporárias ou muito específicas
- Foque em informações que serão úteis em futuras conversas
- Se já existe uma memória sobre o mesmo tópico, atualize em vez de duplicar

${existingMemoriesText ? `Memórias já existentes:\n${existingMemoriesText}\n\nEvite duplicatas. Se a informação já existe, atualize a importância se necessário.` : ''}

Conversa:
${conversationMessages.map(m => `${m.role === 'user' ? 'Usuário' : 'Assistente'}: ${m.content}`).join('\n\n')}

Responda APENAS em formato JSON válido, sem texto adicional antes ou depois:
{
  "memories": [
    {
      "key": "nome_ou_apelido",
      "value": "Texto descritivo claro e conciso",
      "importance": 5
    }
  ]
}

Se não houver informações novas relevantes, retorne: {"memories": []}`

    // Usar modelo rápido e barato para extração
    const result = await callLLM({
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: extractionPrompt }],
      stream: false,
    })

    // Parsear resposta JSON
    let parsedResult: { memories: Array<{ key: string; value: string; importance: number }> }
    
    try {
      // Tentar extrair JSON da resposta (pode ter texto extra)
      const jsonMatch = result.output.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        parsedResult = JSON.parse(jsonMatch[0])
      } else {
        parsedResult = JSON.parse(result.output)
      }
    } catch (parseError) {
      console.error('[MemoryExtractor] Erro ao parsear resposta JSON:', parseError)
      console.error('[MemoryExtractor] Resposta original:', result.output)
      return []
    }

    if (!parsedResult.memories || !Array.isArray(parsedResult.memories)) {
      return []
    }

    // Validar e filtrar memórias
    const validMemories: MemoryItem[] = []

    for (const memory of parsedResult.memories) {
      // Validar estrutura
      if (!memory.key || !memory.value || typeof memory.importance !== 'number') {
        continue
      }

      // Validar importância (1-5)
      if (memory.importance < 1 || memory.importance > 5) {
        memory.importance = Math.max(1, Math.min(5, memory.importance))
      }

      // Verificar PHI antes de salvar
      if (containsPHI(memory.value)) {
        console.warn('[MemoryExtractor] PHI detectado em memória, pulando:', memory.key)
        // Não salvar memórias com PHI automaticamente
        continue
      }

      // Validar tamanho (não deve ser muito grande)
      if (memory.value.length > 500) {
        memory.value = memory.value.substring(0, 497) + '...'
      }

      // Validar key (deve ser uma string válida)
      if (memory.key.length > 100) {
        memory.key = memory.key.substring(0, 97) + '...'
      }

      validMemories.push({
        key: memory.key.trim(),
        value: memory.value.trim(),
        importance: memory.importance,
      })
    }

    // Remover duplicatas (comparar com memórias existentes)
    const existingKeys = new Set(existingMemories.map(m => m.key.toLowerCase()))
    const newMemories = validMemories.filter(
      m => !existingKeys.has(m.key.toLowerCase())
    )

    return newMemories
  } catch (error) {
    console.error('[MemoryExtractor] Erro ao extrair memórias:', error)
    return []
  }
}

/**
 * Verifica se deve extrair memórias da conversa
 * Baseado no número de mensagens e na última extração
 */
export function shouldExtractMemories(
  messageCount: number,
  lastExtractionIndex: number = 0
): boolean {
  const MIN_MESSAGES_FOR_EXTRACTION = 4
  const messagesSinceLastExtraction = messageCount - lastExtractionIndex
  
  return messagesSinceLastExtraction >= MIN_MESSAGES_FOR_EXTRACTION
}

