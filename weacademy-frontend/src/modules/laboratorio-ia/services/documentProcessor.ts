// @ts-nocheck
/**
 * Processador de documentos para Knowledge Base
 * Extrai texto de PDFs, DOCX, TXT, MD
 */

import mammoth from 'mammoth'

export interface ProcessedDocument {
  content: string
  metadata: {
    pages?: number // Para PDFs
    wordCount?: number
    characterCount: number
    [key: string]: any
  }
}

/**
 * Processa um documento baseado no tipo
 */
export async function processDocument(
  file: File | Buffer,
  fileType: 'pdf' | 'txt' | 'docx' | 'md'
): Promise<ProcessedDocument> {
  let content = ''
  let metadata: any = {
    characterCount: 0,
  }

  switch (fileType) {
    case 'pdf': {
      // Importar pdf-parse dinamicamente para evitar erros de build
      const pdfParseModule = await import('pdf-parse')
      const pdfParse = pdfParseModule.default || pdfParseModule

      const buffer = Buffer.isBuffer(file) ? file : await file.arrayBuffer().then(ab => Buffer.from(ab))
      const pdfData = await pdfParse(buffer)
      content = pdfData.text
      metadata.pages = pdfData.numpages
      metadata.info = pdfData.info
      break
    }

    case 'txt':
    case 'md': {
      const text = Buffer.isBuffer(file)
        ? file.toString('utf-8')
        : await file.text()
      content = text
      break
    }

    case 'docx': {
      const buffer = Buffer.isBuffer(file)
        ? file
        : await file.arrayBuffer().then(ab => Buffer.from(ab))
      const result = await mammoth.extractRawText({ buffer })
      content = result.value
      metadata.messages = result.messages // Warnings/errors do mammoth
      break
    }

    default:
      throw new Error(`Tipo de arquivo não suportado: ${fileType}`)
  }

  // Calcular metadados
  const words = content.trim().split(/\s+/).filter(w => w.length > 0)
  metadata.wordCount = words.length
  metadata.characterCount = content.length

  // Limpar e normalizar conteúdo
  content = content
    .replace(/\r\n/g, '\n') // Normalizar line endings
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n') // Remover múltiplas quebras de linha
    .trim()

  return {
    content,
    metadata,
  }
}

/**
 * Divide texto em chunks com overlap
 */
export function chunkText(
  text: string,
  chunkSize: number = 1000,
  chunkOverlap: number = 200
): string[] {
  if (text.length <= chunkSize) {
    return [text]
  }

  const chunks: string[] = []
  let start = 0

  while (start < text.length) {
    let end = start + chunkSize

    // Se não é o último chunk, tentar quebrar em um ponto natural (fim de frase, parágrafo)
    if (end < text.length) {
      // Procurar por ponto de quebra natural próximo ao fim do chunk
      const searchStart = Math.max(start + chunkSize - 100, start)
      const searchEnd = Math.min(end + 100, text.length)
      const searchText = text.substring(searchStart, searchEnd)

      // Priorizar: parágrafo > frase > palavra
      const paragraphBreak = searchText.lastIndexOf('\n\n')
      const sentenceBreak = searchText.lastIndexOf('. ')
      const wordBreak = searchText.lastIndexOf(' ')

      if (paragraphBreak >= 0) {
        end = searchStart + paragraphBreak + 2
      } else if (sentenceBreak >= 0) {
        end = searchStart + sentenceBreak + 2
      } else if (wordBreak >= 0) {
        end = searchStart + wordBreak + 1
      }
    }

    const chunk = text.substring(start, end).trim()
    if (chunk.length > 0) {
      chunks.push(chunk)
    }

    // Avançar com overlap
    start = Math.max(end - chunkOverlap, start + 1)

    // Evitar loop infinito
    if (start >= text.length) {
      break
    }
  }

  return chunks
}

/**
 * Detecta tipo de arquivo baseado na extensão ou mime type
 */
export function detectFileType(filename: string, mimeType?: string): 'pdf' | 'txt' | 'docx' | 'md' | null {
  const ext = filename.toLowerCase().split('.').pop()

  if (mimeType) {
    if (mimeType.includes('pdf')) return 'pdf'
    if (mimeType.includes('word') || mimeType.includes('document')) return 'docx'
    if (mimeType.includes('text')) return ext === 'md' ? 'md' : 'txt'
  }

  switch (ext) {
    case 'pdf':
      return 'pdf'
    case 'docx':
    case 'doc':
      return 'docx'
    case 'txt':
      return 'txt'
    case 'md':
    case 'markdown':
      return 'md'
    default:
      return null
  }
}

