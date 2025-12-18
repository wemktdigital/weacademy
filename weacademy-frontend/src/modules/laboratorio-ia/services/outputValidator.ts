import { z } from 'zod'

export interface ValidationResult {
  isValid: boolean
  errors?: z.ZodError
  quality?: QualityMetrics
  suggestions?: string[]
}

export interface QualityMetrics {
  confidence: number // 0-1: Confiança na qualidade
  coherence: number // 0-1: Coerência do texto
  completeness: number // 0-1: Completude (se atende todos os campos obrigatórios)
}

/**
 * Valida um output usando um schema Zod
 */
export function validateOutput(
  output: string,
  schema?: z.ZodSchema<any>
): ValidationResult {
  if (!schema) {
    // Se não há schema, calcular métricas básicas de qualidade
    const quality = calculateBasicQuality(output)
    return {
      isValid: true,
      quality,
    }
  }

  try {
    // Tentar fazer parse do output (pode ser JSON ou texto)
    let parsedOutput: any

    // Tentar parse como JSON primeiro
    try {
      parsedOutput = JSON.parse(output)
    } catch {
      // Se não for JSON, usar o texto diretamente
      parsedOutput = output
    }

    // Validar com schema
    schema.parse(parsedOutput)

    // Calcular métricas de qualidade
    const quality = calculateQualityMetrics(output, parsedOutput)

    return {
      isValid: true,
      quality,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const suggestions = generateSuggestions(error, output)
      const quality = calculateQualityMetrics(output, null)

      return {
        isValid: false,
        errors: error,
        quality,
        suggestions,
      }
    }

    // Erro inesperado
    return {
      isValid: false,
      quality: calculateBasicQuality(output),
      suggestions: ['Erro inesperado na validação'],
    }
  }
}

/**
 * Calcula métricas básicas de qualidade sem schema
 */
function calculateBasicQuality(output: string): QualityMetrics {
  const length = output.length
  const words = output.split(/\s+/).filter(w => w.length > 0)
  const sentences = output.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const paragraphs = output.split(/\n\s*\n/).filter(p => p.trim().length > 0)

  // Confiança baseada em comprimento e estrutura
  const confidence = Math.min(
    1,
    (length > 50 ? 0.3 : length / 166) + // Mínimo de 50 chars
    (words.length > 10 ? 0.3 : words.length / 33) + // Mínimo de 10 palavras
    (sentences.length > 1 ? 0.2 : sentences.length / 5) + // Mínimo de 1 frase
    (paragraphs.length > 0 ? 0.2 : 0) // Parágrafos
  )

  // Coerência básica (verifica estrutura básica)
  const coherence = Math.min(
    1,
    (output.includes('.') || output.includes('!') || output.includes('?')) ? 0.7 : 0.3 +
      (words.length > 5 ? 0.3 : 0)
  )

  // Completude assume 1 se há conteúdo
  const completeness = length > 0 ? 1 : 0

  return {
    confidence,
    coherence,
    completeness,
  }
}

/**
 * Calcula métricas de qualidade com base no output e schema
 */
function calculateQualityMetrics(
  output: string,
  parsedOutput: any
): QualityMetrics {
  const basicQuality = calculateBasicQuality(output)

  if (!parsedOutput) {
    return basicQuality
  }

  // Se parsedOutput é um objeto, calcular métricas mais precisas
  if (typeof parsedOutput === 'object' && parsedOutput !== null) {
    const keys = Object.keys(parsedOutput)
    const values = Object.values(parsedOutput).filter(v => v !== null && v !== undefined && v !== '')

    // Completude: percentual de campos preenchidos
    const completeness = keys.length > 0
      ? Math.min(1, values.length / keys.length)
      : basicQuality.completeness

    // Confiança: baseada em estrutura + completude
    const confidence = Math.min(1, basicQuality.confidence * 0.7 + completeness * 0.3)

    return {
      confidence,
      coherence: basicQuality.coherence,
      completeness,
    }
  }

  return basicQuality
}

/**
 * Gera sugestões de correção baseadas nos erros de validação
 */
function generateSuggestions(error: z.ZodError, output: string): string[] {
  const suggestions: string[] = []

  const validationErrors = (error as any).errors as any[];
  validationErrors.forEach((err: any) => {
    const path = err.path.join('.')
    const code = err.code

    switch (code) {
      case 'too_small':
        if (err.type === 'string') {
          suggestions.push(`O campo "${path}" deve ter pelo menos ${err.minimum} caracteres`)
        } else if (err.type === 'number') {
          suggestions.push(`O campo "${path}" deve ser pelo menos ${err.minimum}`)
        } else if (err.type === 'array') {
          suggestions.push(`O campo "${path}" deve ter pelo menos ${err.minimum} itens`)
        }
        break
      case 'too_big':
        if (err.type === 'string') {
          suggestions.push(`O campo "${path}" deve ter no máximo ${err.maximum} caracteres`)
        } else if (err.type === 'number') {
          suggestions.push(`O campo "${path}" deve ser no máximo ${err.maximum}`)
        } else if (err.type === 'array') {
          suggestions.push(`O campo "${path}" deve ter no máximo ${err.maximum} itens`)
        }
        break
      case 'invalid_type':
        suggestions.push(`O campo "${path}" deve ser do tipo ${err.expected}, mas recebeu ${err.received}`)
        break
      case 'invalid_string':
        if (err.validation === 'email') {
          suggestions.push(`O campo "${path}" deve ser um email válido`)
        } else if (err.validation === 'url') {
          suggestions.push(`O campo "${path}" deve ser uma URL válida`)
        } else if (err.validation === 'uuid') {
          suggestions.push(`O campo "${path}" deve ser um UUID válido`)
        } else {
          suggestions.push(`O campo "${path}" tem formato inválido`)
        }
        break
      case 'custom':
        suggestions.push(`O campo "${path}": ${err.message}`)
        break
      default:
        suggestions.push(`Erro no campo "${path}": ${err.message}`)
    }
  })

  // Sugestões adicionais se o output parece ser JSON inválido
  if (suggestions.length === 0) {
    try {
      JSON.parse(output)
    } catch {
      suggestions.push('O output parece não estar em formato JSON válido. Tente formatar como JSON.')
    }
  }

  return suggestions
}

/**
 * Cria um schema Zod a partir de uma definição em JSON string ou objeto
 */
export function createSchemaFromDefinition(definition: string | object | z.ZodSchema<any>): z.ZodSchema<any> | undefined {
  if (!definition) return undefined

  // Se já é um schema Zod, retornar
  if (definition && typeof definition === 'object' && 'parse' in definition && typeof (definition as any).parse === 'function') {
    return definition as z.ZodSchema<any>
  }

  // Se é string, tentar fazer parse
  if (typeof definition === 'string') {
    try {
      const parsed = JSON.parse(definition)
      return createZodSchemaFromObject(parsed)
    } catch {
      console.error('[OutputValidator] Não foi possível fazer parse da definição do schema:', definition)
      return undefined
    }
  }

  // Se é objeto, criar schema
  if (typeof definition === 'object') {
    return createZodSchemaFromObject(definition as any)
  }

  return undefined
}

/**
 * Cria um schema Zod a partir de um objeto de definição simples
 * Formato esperado: { type: 'string', min?: 10, max?: 100, required?: true }
 * ou { properties: { field: { type: 'string', ... } }, required?: ['field'] }
 */
function createZodSchemaFromObject(def: any): z.ZodSchema<any> {
  // Se tem properties, é um objeto
  if (def.properties) {
    const shape: Record<string, z.ZodTypeAny> = {}

    Object.keys(def.properties).forEach((key) => {
      const propDef = def.properties[key]
      shape[key] = createZodTypeFromDef(propDef, !def.required?.includes(key))
    })

    return z.object(shape)
  }

  // Se é um tipo simples, criar schema simples
  return createZodTypeFromDef(def, false)
}

function createZodTypeFromDef(def: any, optional: boolean): z.ZodTypeAny {
  let schema: z.ZodTypeAny

  switch (def.type) {
    case 'string':
      schema = z.string()
      if (def.min !== undefined) schema = (schema as z.ZodString).min(def.min)
      if (def.max !== undefined) schema = (schema as z.ZodString).max(def.max)
      if (def.email) schema = (schema as z.ZodString).email()
      if (def.url) schema = (schema as z.ZodString).url()
      if (def.regex) schema = (schema as z.ZodString).regex(new RegExp(def.regex))
      break
    case 'number':
      schema = z.number()
      if (def.min !== undefined) schema = (schema as z.ZodNumber).min(def.min)
      if (def.max !== undefined) schema = (schema as z.ZodNumber).max(def.max)
      if (def.int) schema = (schema as z.ZodNumber).int()
      break
    case 'boolean':
      schema = z.boolean()
      break
    case 'array':
      schema = z.array(def.items ? createZodTypeFromDef(def.items, false) : z.any())
      if (def.min !== undefined) schema = (schema as z.ZodArray<any>).min(def.min)
      if (def.max !== undefined) schema = (schema as z.ZodArray<any>).max(def.max)
      break
    case 'object':
      if (def.properties) {
        const shape: Record<string, z.ZodTypeAny> = {}
        Object.keys(def.properties).forEach((key) => {
          shape[key] = createZodTypeFromDef(def.properties[key], !def.required?.includes(key))
        })
        schema = z.object(shape)
      } else {
        schema = z.any()
      }
      break
    default:
      schema = z.any()
  }

  return optional ? schema.optional() : schema
}

