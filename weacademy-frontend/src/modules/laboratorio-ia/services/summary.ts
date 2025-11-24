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
    /\b\d{3}\s\d{3}\s\d{3}-\d{2}\b/, // CPF com espaços
    /\b\d{11}\b/, // CPF sem formatação (11 dígitos)
    /\b\d{2}\.\d{3}\.\d{3}-\d{1}\b/, // RG
    /\b\d{2}\s\d{3}\s\d{3}-\d{1}\b/, // RG com espaços
    /\b\d{2}\/\d{2}\/\d{4}\b/, // Data de nascimento (formato DD/MM/YYYY)
    /\b\d{4}-\d{2}-\d{2}\b/, // Data de nascimento (formato YYYY-MM-DD)
    /\b(paciente|sr\.|sra\.|dr\.|dra\.)\s+[A-ZÀ-ÜÁÉÍÓÚ][a-zà-üáéíóú]+(?:\s+[A-ZÀ-ÜÁÉÍÓÚ][a-zà-üáéíóú]+)+/i, // Nomes completos com prefixo (pelo menos 2 palavras capitalizadas)
    /\b(sr|sra|dr|dra|paciente)\s+[A-ZÀ-ÜÁÉÍÓÚ][a-zà-üáéíóú]+(?:\s+[A-ZÀ-ÜÁÉÍÓÚ][a-zà-üáéíóú]+)+/i, // Nomes sem ponto após prefixo
    /\b(paciente|sr\.|sra\.|dr\.|dra\.|sr|sra|dr|dra)\s+[A-ZÀ-ÜÁÉÍÓÚ][a-zà-üáéíóú]+\b/i, // Nomes simples com prefixo (apenas primeiro nome)
    /\b\d{2}\s\d{4,5}-?\d{4}\b/, // Telefone (formato com DDD)
    /\b\d{4,5}-?\d{4}\b/, // Telefone sem DDD
    /\b\(\d{2}\)\s?\d{4,5}-?\d{4}\b/, // Telefone com parênteses
    /\b\w+@\w+\.\w+\b/, // Email
    /\b\d{5}-?\d{3}\b/, // CEP
    /\b\d{5}\s\d{3}\b/, // CEP com espaço
    /\b(cpf|rg|cnh|telefone|celular|email|cep|endereço|rua|avenida|bairro|cidade)\s*[:\-]?\s*[\w\s\d\-\.@]+/i, // Identificadores seguidos de informação
    /\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/, // Cartão de crédito
    /\b\d{3}\s?\d{3}\s?\d{3}\s?\d{3}\b/, // Cartão de crédito (16 dígitos formatado)
  ]
  
  // Verificar se texto contém padrões PHI
  const hasPHIPattern = phiPatterns.some(pattern => pattern.test(text))
  
  // Verificar também se há contexto médico seguido de informações pessoais
  const medicalContextPattern = /(diagnóstico|tratamento|medicação|receita|exame|resultado|prontuário|histórico médico)/i
  const personalInfoPattern = /(nome|idade|data|telefone|endereço|email|cpf|rg)/i
  
  const hasMedicalContext = medicalContextPattern.test(text) && personalInfoPattern.test(text)
  
  return hasPHIPattern || hasMedicalContext
}

/**
 * Sanitiza texto removendo ou mascarando PHI
 */
export function sanitizePHI(text: string): string {
  let sanitized = text
  
  // Mascarar CPFs (vários formatos)
  sanitized = sanitized.replace(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g, '[CPF]')
  sanitized = sanitized.replace(/\b\d{3}\s\d{3}\s\d{3}-\d{2}\b/g, '[CPF]')
  sanitized = sanitized.replace(/\b\d{11}\b(?=\D|$)/g, (match) => {
    // Verificar se é CPF (11 dígitos)
    if (/^\d{11}$/.test(match)) {
      return '[CPF]'
    }
    return match
  })
  
  // Mascarar RGs
  sanitized = sanitized.replace(/\b\d{2}\.\d{3}\.\d{3}-\d{1}\b/g, '[RG]')
  sanitized = sanitized.replace(/\b\d{2}\s\d{3}\s\d{3}-\d{1}\b/g, '[RG]')
  
  // Mascarar datas específicas
  sanitized = sanitized.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '[DATA]')
  sanitized = sanitized.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATA]')
  
  // Mascarar telefones (vários formatos)
  sanitized = sanitized.replace(/\b\(\d{2}\)\s?\d{4,5}-?\d{4}\b/g, '[TELEFONE]')
  sanitized = sanitized.replace(/\b\d{2}\s\d{4,5}-?\d{4}\b/g, '[TELEFONE]')
  sanitized = sanitized.replace(/\b\d{4,5}-?\d{4}\b/g, '[TELEFONE]')
  
  // Mascarar emails
  sanitized = sanitized.replace(/\b\w+@\w+\.\w+\b/g, '[EMAIL]')
  
  // Mascarar CEPs
  sanitized = sanitized.replace(/\b\d{5}-?\d{3}\b/g, '[CEP]')
  sanitized = sanitized.replace(/\b\d{5}\s\d{3}\b/g, '[CEP]')
  
  // Mascarar cartões de crédito
  sanitized = sanitized.replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[CARTÃO]')
  
  return sanitized
}
