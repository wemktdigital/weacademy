import { createClient } from '@/lib/supabase'
import { callLLM } from './llmRouter'

/**
 * Gera resumo de uma conversa usando LLM
 */
export async function summarizeConversation({
  conversationId,
  userId,
  agentId,
  messages,
}: {
  conversationId?: string
  userId: string
  agentId?: string
  messages: any[]
}) {
  try {
    // Preparar mensagens para resumo (ultimas 10-20)
    const recentMessages = messages.slice(-20)
    
    const summaryPrompt = `Resuma a conversa abaixo em 2-3 frases concisas. Mantenha apenas informações essenciais e ações importantes.
    
Conversa:
${recentMessages.map(m => `${m.role}: ${m.content}`).join('\n')}

Resumo:`

    // Usar modelo rápido e barato para resumo
    const result = await callLLM({
      provider: 'OpenAI',
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: summaryPrompt }],
      stream: false,
    })

    const summary = result.output.trim()

    // Estimar tokens (aproximação: 1 palavra = 1.3 tokens)
    const tokensEst = Math.ceil(summary.split(' ').length * 1.3)

    // Salvar resumo no banco
    const supabase = await createClient()
    const { error } = await supabase
      .from('lab_conversation_summaries')
      .insert({
        conversation_id: conversationId || null,
        user_id: userId,
        agent_id: agentId || null,
        summary,
        tokens_est: tokensEst,
      })

    if (error) {
      console.error('Error saving summary:', error)
    }

    // Limpar resumos antigos (manter apenas últimos 5)
    await supabase.rpc('cleanup_old_summaries')

    return summary
  } catch (error) {
    console.error('Error summarizing conversation:', error)
    return null
  }
}

/**
 * Detecta se deve criar resumo baseado no número de mensagens
 */
export function shouldSummarize(messages: any[], lastSummaryIndex: number = 0): boolean {
  const MIN_MESSAGES_FOR_SUMMARY = 10
  const messagesSinceLastSummary = messages.length - lastSummaryIndex
  
  return messagesSinceLastSummary >= MIN_MESSAGES_FOR_SUMMARY
}

/**
 * Extrai fatos importantes das mensagens para salvar na memória
 */
export function extractFacts(messages: any[]): Array<{ key: string; value: string; importance: number }> {
  const facts: Array<{ key: string; value: string; importance: number }> = []
  
  // Buscar por padrões comuns (especialidade, preferências, etc)
  const recentContent = messages.slice(-10).map(m => m.content).join(' ').toLowerCase()
  
  // Exemplos de extração simples (pode ser expandido com LLM)
  const patterns = [
    { regex: /minha especialidade (?:é|é|sou)\s+([^.]+?)[\.\n]?/i, key: 'especialidade_medica', importance: 4 },
    { regex: /prefiro (?:usar|escrever em)\s+([^.]+?)[\.\n]?/i, key: 'preferencia_linguagem', importance: 2 },
    { regex: /meu objetivo (?:é|é)\s+([^.]+?)[\.\n]?/i, key: 'objetivo_principal', importance: 3 },
  ]
  
  patterns.forEach(({ regex, key, importance }) => {
    const match = recentContent.match(regex)
    if (match && match[1]) {
      facts.push({
        key,
        value: match[1].trim(),
        importance,
      })
    }
  })
  
  return facts
}

/**
 * Verifica se texto contém informações sensíveis de pacientes (PHI)
 */
export function containsPHI(text: string): boolean {
  const phiPatterns = [
    /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/, // CPF
    /\b\d{2}\/\d{2}\/\d{4}\b/, // Data de nascimento
    /\b(paciente|sr\.|sra\.|dr\.|dra\.)\s+\w+/i, // Nomes
    /\b\d{4}-?\d{4}\b/, // Telefone
    /\b\w+@\w+\.\w+\b/, // Email com contexto médico
  ]
  
  return phiPatterns.some(pattern => pattern.test(text))
}

/**
 * Sanitiza texto removendo ou mascarando PHI
 */
export function sanitizePHI(text: string): string {
  let sanitized = text
  
  // Mascarar CPFs
  sanitized = sanitized.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]')
  
  // Mascarar datas específicas
  sanitized = sanitized.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '[DATA]')
  
  // Mascarar telefones
  sanitized = sanitized.replace(/\b\d{4}-?\d{4}\b/g, '[TELEFONE]')
  
  return sanitized
}
