/**
 * Avaliador de condições para pipelines condicionais
 */

export type ConditionType = 'contains' | 'length' | 'regex' | 'sentiment'
export type ConditionOperator = 'equals' | 'greater' | 'less' | 'not_equals'

export interface Condition {
  type: ConditionType
  value: string | number
  operator?: ConditionOperator
}

/**
 * Avalia se uma condição é verdadeira baseada no contexto fornecido
 */
export function evaluateCondition(
  condition: Condition,
  context: string
): boolean {
  if (!context || typeof context !== 'string') {
    return false
  }

  try {
    switch (condition.type) {
      case 'contains':
        return evaluateContains(condition, context)
      
      case 'length':
        return evaluateLength(condition, context)
      
      case 'regex':
        return evaluateRegex(condition, context)
      
      case 'sentiment':
        return evaluateSentiment(condition, context)
      
      default:
        console.warn(`[ConditionEvaluator] Tipo de condição desconhecido: ${condition.type}`)
        return false
    }
  } catch (error) {
    console.error(`[ConditionEvaluator] Erro ao avaliar condição:`, error)
    return false
  }
}

/**
 * Avalia condição "contains" - verifica se o contexto contém um valor
 */
function evaluateContains(condition: Condition, context: string): boolean {
  const searchValue = String(condition.value).toLowerCase()
  const contextLower = context.toLowerCase()
  
  if (condition.operator === 'not_equals') {
    return !contextLower.includes(searchValue)
  }
  
  // Default: equals (contains)
  return contextLower.includes(searchValue)
}

/**
 * Avalia condição "length" - verifica o comprimento do contexto
 */
function evaluateLength(condition: Condition, context: string): boolean {
  const length = context.length
  const targetLength = typeof condition.value === 'number' 
    ? condition.value 
    : parseInt(String(condition.value), 10)
  
  if (isNaN(targetLength)) {
    console.warn(`[ConditionEvaluator] Valor de length inválido: ${condition.value}`)
    return false
  }
  
  switch (condition.operator || 'equals') {
    case 'equals':
      return length === targetLength
    case 'greater':
      return length > targetLength
    case 'less':
      return length < targetLength
    case 'not_equals':
      return length !== targetLength
    default:
      return length === targetLength
  }
}

/**
 * Avalia condição "regex" - verifica se o contexto corresponde a uma expressão regular
 */
function evaluateRegex(condition: Condition, context: string): boolean {
  try {
    const pattern = String(condition.value)
    const regex = new RegExp(pattern, 'i') // Case-insensitive
    
    if (condition.operator === 'not_equals') {
      return !regex.test(context)
    }
    
    // Default: equals (matches)
    return regex.test(context)
  } catch (error) {
    console.error(`[ConditionEvaluator] Erro ao compilar regex:`, error)
    return false
  }
}

/**
 * Avalia condição "sentiment" - análise simples de sentimento
 * 0 = negativo, 1 = neutro, 2 = positivo
 */
function evaluateSentiment(condition: Condition, context: string): boolean {
  // Palavras-chave básicas para análise de sentimento
  const positiveWords = ['excelente', 'ótimo', 'bom', 'perfeito', 'maravilhoso', 'fantástico', 'incrível', 'positivo', 'satisfeito', 'feliz']
  const negativeWords = ['ruim', 'péssimo', 'terrível', 'horrível', 'negativo', 'insatisfeito', 'triste', 'preocupado', 'problema', 'erro']
  
  const contextLower = context.toLowerCase()
  
  // Contar ocorrências de palavras positivas e negativas
  const positiveCount = positiveWords.filter(word => contextLower.includes(word)).length
  const negativeCount = negativeWords.filter(word => contextLower.includes(word)).length
  
  // Determinar sentimento (0 = negativo, 1 = neutro, 2 = positivo)
  let sentiment: number
  if (negativeCount > positiveCount) {
    sentiment = 0
  } else if (positiveCount > negativeCount) {
    sentiment = 2
  } else {
    sentiment = 1
  }
  
  const targetSentiment = typeof condition.value === 'number'
    ? condition.value
    : parseInt(String(condition.value), 10)
  
  if (isNaN(targetSentiment)) {
    console.warn(`[ConditionEvaluator] Valor de sentiment inválido: ${condition.value}`)
    return false
  }
  
  switch (condition.operator || 'equals') {
    case 'equals':
      return sentiment === targetSentiment
    case 'greater':
      return sentiment > targetSentiment
    case 'less':
      return sentiment < targetSentiment
    case 'not_equals':
      return sentiment !== targetSentiment
    default:
      return sentiment === targetSentiment
  }
}

/**
 * Merge múltiplos outputs usando uma estratégia
 */
export function mergeOutputs(
  outputs: string[],
  strategy: 'concat' | 'first' | 'last' | 'longest' = 'concat'
): string {
  if (outputs.length === 0) {
    return ''
  }
  
  if (outputs.length === 1) {
    return outputs[0]
  }
  
  switch (strategy) {
    case 'concat':
      return outputs.join('\n\n---\n\n')
    
    case 'first':
      return outputs[0]
    
    case 'last':
      return outputs[outputs.length - 1]
    
    case 'longest':
      return outputs.reduce((longest, current) => 
        current.length > longest.length ? current : longest
      )
    
    default:
      return outputs.join('\n\n---\n\n')
  }
}

