// @ts-nocheck
/**
 * Sistema de processamento de variáveis e transformações para pipelines
 */

export interface VariableContext {
  [key: string]: string | number | boolean | null | undefined
}

export interface TransformationConfig {
  type: 'truncate' | 'summarize' | 'format' | 'extract_json' | 'extract_text' | 'uppercase' | 'lowercase' | 'capitalize'
  params?: {
    maxLength?: number
    format?: string
    extractKey?: string
  }
}

/**
 * Extrai variáveis de um template string (ex: "Olá {{nome}}, bem-vindo!")
 */
export function extractVariables(template: string): string[] {
  const regex = /\{\{([^}]+)\}\}/g
  const matches = template.matchAll(regex)
  const variables: string[] = []

  for (const match of matches) {
    const varName = match[1].trim()
    if (varName && !variables.includes(varName)) {
      variables.push(varName)
    }
  }

  return variables
}

/**
 * Substitui variáveis em um template string pelo valor do contexto
 */
export function processTemplate(template: string, context: VariableContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, varName) => {
    const trimmedVarName = varName.trim()

    // Verificar se tem transformação (ex: {{titulo|uppercase}})
    if (trimmedVarName.includes('|')) {
      const [actualVarName, transform] = trimmedVarName.split('|').map(s => s.trim())
      const value = getVariableValue(actualVarName, context)
      return applyTransformation(String(value || ''), transform)
    }

    const value = getVariableValue(trimmedVarName, context)
    return String(value ?? '')
  })
}

/**
 * Obtém valor de uma variável do contexto, suportando caminhos (ex: "step1.output")
 */
function getVariableValue(varName: string, context: VariableContext): string | number | boolean | null | undefined {
  // Se é um caminho (ex: "step1.output" ou "step_1.titulo")
  if (varName.includes('.')) {
    const parts = varName.split('.')
    let current: any = context

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part]
      } else {
        return undefined
      }
    }

    return current
  }

  // Variável simples
  return context[varName]
}

/**
 * Aplica uma transformação a um valor
 */
function applyTransformation(value: string, transform: string): string {
  const [transformType, ...params] = transform.split(':').map(s => s.trim())

  switch (transformType.toLowerCase()) {
    case 'uppercase':
    case 'upper':
      return value.toUpperCase()

    case 'lowercase':
    case 'lower':
      return value.toLowerCase()

    case 'capitalize':
      return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()

    case 'truncate':
      const maxLength = params[0] ? parseInt(params[0], 10) : 100
      return value.length > maxLength ? value.substring(0, maxLength) + '...' : value

    case 'extract_json':
      try {
        const json = JSON.parse(value)
        const key = params[0] || 'content'
        return json[key] || JSON.stringify(json)
      } catch {
        return value
      }

    case 'extract_text':
      // Extrair texto de JSON se possível
      try {
        const json = JSON.parse(value)
        if (typeof json === 'object') {
          // Tentar extrair campos de texto comuns
          return json.text || json.content || json.message || JSON.stringify(json)
        }
      } catch {
        // Se não é JSON, retornar como está
      }
      return value

    case 'format':
      // Formatação simples (ex: format:json, format:number)
      const formatType = params[0]?.toLowerCase()
      if (formatType === 'json') {
        try {
          const parsed = JSON.parse(value)
          return JSON.stringify(parsed, null, 2)
        } catch {
          return value
        }
      }
      return value

    default:
      return value
  }
}

/**
 * Aplica transformações configuradas a um output
 */
export function applyTransformations(
  output: string,
  transformations: TransformationConfig[]
): string {
  let result = output

  for (const transform of transformations) {
    switch (transform.type) {
      case 'truncate':
        const maxLength = transform.params?.maxLength || 100
        result = result.length > maxLength
          ? result.substring(0, maxLength) + '...'
          : result
        break

      case 'summarize':
        // Sumarização simples (primeira sentença + ...)
        const sentences = result.split(/[.!?]+/)
        result = sentences[0] + (sentences.length > 1 ? '...' : '')
        break

      case 'format':
        if (transform.params?.format === 'json') {
          try {
            const parsed = JSON.parse(result)
            result = JSON.stringify(parsed, null, 2)
          } catch {
            // Se não é JSON, manter como está
          }
        }
        break

      case 'extract_json':
        try {
          const json = JSON.parse(result)
          const key = transform.params?.extractKey || 'content'
          result = json[key] || JSON.stringify(json)
        } catch {
          // Se não é JSON, manter como está
        }
        break

      case 'extract_text':
        try {
          const json = JSON.parse(result)
          if (typeof json === 'object') {
            result = json.text || json.content || json.message || JSON.stringify(json)
          }
        } catch {
          // Se não é JSON, manter como está
        }
        break

      case 'uppercase':
        result = result.toUpperCase()
        break

      case 'lowercase':
        result = result.toLowerCase()
        break

      case 'capitalize':
        result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase()
        break
    }
  }

  return result
}

/**
 * Cria um contexto de variáveis a partir de outputs de steps anteriores
 */
export function buildVariableContext(
  executedSteps: Array<{ agent_id: string; order: number; output: string }>,
  inputMessages?: any[]
): VariableContext {
  const context: VariableContext = {}

  // Adicionar mensagens de input como variáveis
  if (inputMessages && inputMessages.length > 0) {
    const firstMessage = inputMessages[0]
    context.input = typeof firstMessage === 'string'
      ? firstMessage
      : firstMessage?.content || ''

    // Adicionar mensagem completa
    context.messages = JSON.stringify(inputMessages)
  }

  // Adicionar outputs de steps anteriores
  executedSteps.forEach((step, index) => {
    const stepKey = `step${step.order}` || `step_${index + 1}`

    // Output direto
    context[stepKey] = step.output
    context[`${stepKey}.output`] = step.output

    // Tentar parsear como JSON e adicionar campos individuais
    try {
      const parsed = JSON.parse(step.output)
      if (typeof parsed === 'object' && parsed !== null) {
        Object.keys(parsed).forEach(key => {
          context[`${stepKey}.${key}`] = parsed[key]
        })

        // Adicionar objeto completo
        context[stepKey] = parsed
      }
    } catch {
      // Se não é JSON, manter como string
    }

    // Variáveis aliases para acesso rápido
    context[`output_${index + 1}`] = step.output
    context[`previous_output`] = step.output // Último output
  })

  // Adicionar último output como variável especial
  if (executedSteps.length > 0) {
    const lastStep = executedSteps[executedSteps.length - 1]
    context.last_output = lastStep.output
    context.previous = lastStep.output
  }

  return context
}

/**
 * Processa prompt com variáveis e transformações
 */
export function processPrompt(
  prompt: string,
  context: VariableContext
): string {
  return processTemplate(prompt, context)
}

/**
 * Processa output com transformações
 */
export function processOutput(
  output: string,
  transformations?: TransformationConfig[],
  context?: VariableContext
): string {
  let result = output

  // Aplicar transformações se especificadas
  if (transformations && transformations.length > 0) {
    result = applyTransformations(result, transformations)
  }

  // Processar variáveis no output (caso queira incluir outras variáveis)
  if (context) {
    result = processTemplate(result, context)
  }

  return result
}

