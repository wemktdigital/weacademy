import { createClient } from '@supabase/supabase-js'

export interface KnowledgeFile {
  name: string
  url: string
}

/**
 * Gera URL assinada para acessar arquivo do Supabase Storage
 */
async function getSignedUrl(fileUrl: string): Promise<string> {
  try {
    // Se já é uma URL completa (http/https), tentar usar diretamente primeiro
    if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://')) {
      // Verificar se é URL assinada válida ou URL pública
      try {
        const testResponse = await fetch(fileUrl, { method: 'HEAD' })
        if (testResponse.ok) {
          console.log('[KnowledgeBase] Usando URL existente:', fileUrl)
          return fileUrl
        }
      } catch (error) {
        console.warn('[KnowledgeBase] URL não acessível, tentando gerar nova:', error)
        // Se falhar, tentar gerar URL assinada
      }

      // Se contém /storage/v1/object/sign/, já é URL assinada válida
      if (fileUrl.includes('/storage/v1/object/sign/')) {
        console.log('[KnowledgeBase] URL assinada detectada:', fileUrl)
        return fileUrl
      }
    }

    // Extrair path do arquivo da URL
    let storagePath = fileUrl
    
    // Se for URL completa, tentar extrair o path
    if (fileUrl.includes('/storage/v1/object/sign/')) {
      // Tentar extrair o path da URL assinada
      // Pode ter formato: /object/sign/knowledge-base/nome-arquivo ou /object/sign/knowledge-base/knowledge-base/nome-arquivo
      const match = fileUrl.match(/\/object\/sign\/knowledge-base\/([^?]+)/)
      if (match) {
        storagePath = match[1]
        // Se o path começar com "knowledge-base/", remover a duplicação
        if (storagePath.startsWith('knowledge-base/')) {
          storagePath = storagePath.replace('knowledge-base/', '')
        }
      }
    } else if (fileUrl.includes('/storage/v1/object/public/')) {
      const match = fileUrl.match(/\/object\/public\/knowledge-base\/(.+)/)
      if (match) {
        storagePath = match[1]
        // Se o path começar com "knowledge-base/", remover a duplicação
        if (storagePath.startsWith('knowledge-base/')) {
          storagePath = storagePath.replace('knowledge-base/', '')
        }
      }
    } else if (!fileUrl.startsWith('http')) {
      // Se não começar com http, assume que é o path direto
      storagePath = fileUrl
      // Se o path começar com "knowledge-base/", remover
      if (storagePath.startsWith('knowledge-base/')) {
        storagePath = storagePath.replace('knowledge-base/', '')
      }
    }

    // Remover query parameters se houver
    storagePath = storagePath.split('?')[0]

    // Gerar URL assinada usando service role
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const bucketName = 'knowledge-base'

    console.log('[KnowledgeBase] Gerando URL assinada para:', storagePath)

    const { data: signedUrlData, error: signedError } = await serviceRoleSupabase
      .storage
      .from(bucketName)
      .createSignedUrl(storagePath, 3600) // Válida por 1 hora

    if (signedError) {
      console.error('[KnowledgeBase] Erro ao gerar URL assinada:', signedError)
      // Tentar usar URL original
      return fileUrl
    }

    console.log('[KnowledgeBase] URL assinada gerada com sucesso')
    return signedUrlData.signedUrl
  } catch (error: any) {
    console.error('[KnowledgeBase] Erro ao processar URL:', error)
    // Retornar URL original em caso de erro
    return fileUrl
  }
}

/**
 * Extrai texto de um arquivo baixado do Supabase Storage
 * Por enquanto, suporta apenas arquivos de texto simples
 * PDF, DOCX requerem bibliotecas específicas (implementação futura)
 */
async function extractTextFromFile(
  fileUrl: string,
  fileName: string
): Promise<string> {
  try {
    // Obter URL válida para acessar o arquivo
    const validUrl = await getSignedUrl(fileUrl)
    
    // Detectar tipo do arquivo pela extensão
    const extension = fileName.split('.').pop()?.toLowerCase()

    // Para arquivos de texto (TXT, MD)
    if (['txt', 'md'].includes(extension || '')) {
      const response = await fetch(validUrl)
      if (!response.ok) {
        throw new Error(`Erro ao baixar arquivo: ${response.status} ${response.statusText}`)
      }
      const text = await response.text()
      return text
    }

    // Para PDF - usar pdf-parse
    if (extension === 'pdf') {
      try {
        // Importar pdf-parse dinamicamente
        const pdfParseModule = await import('pdf-parse')
        // pdf-parse exporta PDFParse como named export
        const PDFParse = (pdfParseModule as any).PDFParse || (pdfParseModule as any).default?.PDFParse || (pdfParseModule as any).default
        
        if (!PDFParse) {
          throw new Error('PDFParse não encontrado no módulo')
        }

        // Configurar worker do pdf.js se disponível
        try {
          const pdfjs = await import('pdfjs-dist')
          // @ts-ignore
          if (pdfjs.GlobalWorkerOptions?.workerSrc === '') {
            // @ts-ignore
            pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.mjs')
          }
        } catch (e) {
          console.warn('[KnowledgeBase] Não foi possível configurar pdf.js worker, continuando sem ele')
        }
        
        // Baixar o arquivo como buffer
        const response = await fetch(validUrl)
        if (!response.ok) {
          throw new Error(`Erro ao baixar PDF: ${response.status} ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Criar instância do PDFParse e extrair TODO o conteúdo
        const pdfParse = new PDFParse({ data: buffer, verbosity: 0 })
        
        // Extrair texto do PDF - getText() já extrai todas as páginas
        const pdfData = await pdfParse.getText()
        
        // O PDFParse retorna texto de todas as páginas em pdfData.text
        let text = ''
        
        // Verificar se temos texto direto
        if (pdfData && typeof pdfData === 'object' && 'text' in pdfData) {
          text = pdfData.text
        } else if (pdfData && typeof pdfData === 'string') {
          text = pdfData
        }
        
        // Se não tiver texto direto, verificar se tem páginas
        if (!text || text.trim().length === 0) {
          if (pdfData && typeof pdfData === 'object' && 'pages' in pdfData) {
            const pages = pdfData.pages
            if (Array.isArray(pages) && pages.length > 0) {
              text = pages.map((p: any) => p.text || '').join('\n')
            }
          }
        }
        
        if (!text || text.trim().length === 0) {
          console.warn(`[KnowledgeBase] PDF ${fileName} não contém texto extraível`)
          return `[Arquivo PDF: ${fileName}] O arquivo não contém texto extraível ou está protegido.`
        }
        
        console.log(`[KnowledgeBase] Texto extraído do PDF ${fileName}: ${text.length} caracteres`)
        return text
      } catch (error: any) {
        console.error(`[KnowledgeBase] Erro ao processar PDF ${fileName}:`, error)
        
        // Retornar string vazia para que o erro não apareça no prompt
        // O agente vai trabalhar com o conteúdo que conseguiu extrair
        return ''
      }
    }

    // Para DOCX - usar mammoth
    if (extension === 'docx') {
      try {
        // Importar mammoth dinamicamente
        const mammoth = await import('mammoth')
        
        // Baixar o arquivo como buffer
        const response = await fetch(validUrl)
        if (!response.ok) {
          throw new Error(`Erro ao baixar DOCX: ${response.status} ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        
        // Extrair texto do DOCX
        const result = await mammoth.extractRawText({ buffer })
        const text = result.value
        
        if (!text || text.trim().length === 0) {
          console.warn(`[KnowledgeBase] DOCX ${fileName} não contém texto extraível`)
          return ''
        }
        
        console.log(`[KnowledgeBase] Texto extraído do DOCX ${fileName}: ${text.length} caracteres`)
        return text
      } catch (error: any) {
        console.error(`[KnowledgeBase] Erro ao processar DOCX ${fileName}:`, error)
        return ''
      }
    }

    // Se não reconhecer o formato, retornar nome do arquivo
    return `[Arquivo: ${fileName}] Formato não suportado para extração automática de texto. Formatos suportados: TXT, MD.`
  } catch (error: any) {
    console.error(`[KnowledgeBase] Erro ao processar arquivo ${fileName}:`, error)
    return `[Erro ao processar ${fileName}: ${error.message}]`
  }
}

/**
 * Processa todos os arquivos de conhecimento de um agente
 * e retorna o texto extraído concatenado
 */
export async function processKnowledgeFiles(
  files: KnowledgeFile[]
): Promise<string> {
  if (!files || files.length === 0) {
    return ''
  }

  console.log(`[KnowledgeBase] Processando ${files.length} arquivo(s) de conhecimento`)

  const extractedTexts = await Promise.all(
    files.map(async (file) => {
      try {
        const text = await extractTextFromFile(file.url, file.name)
        // Só incluir se houver texto válido (sem erros/avisos)
        if (text && text.trim().length > 0 && !text.includes('[Aviso sobre') && !text.includes('[Erro ao processar')) {
          return `\n---\nArquivo: ${file.name}\n---\n${text}\n`
        }
        return ''
      } catch (error: any) {
        console.error(`[KnowledgeBase] Erro ao processar ${file.name}:`, error)
        // Retornar vazio para não poluir o prompt com erros
        return ''
      }
    })
  )
  
  // Filtrar textos vazios
  const validTexts = extractedTexts.filter(text => text.trim().length > 0)

  const combinedText = validTexts.join('\n\n')
  
  console.log(`[KnowledgeBase] Texto extraído: ${combinedText.length} caracteres`)
  
  return combinedText
}

/**
 * Incorpora o conteúdo da base de conhecimento ao prompt do agente
 */
export function enhancePromptWithKnowledge(
  originalPrompt: string,
  knowledgeContent: string
): string {
  if (!knowledgeContent || knowledgeContent.trim().length === 0) {
    return originalPrompt
  }

  // Remover avisos de erro de processamento antes de incluir no prompt
  const cleanedKnowledge = knowledgeContent
    .replace(/\[Aviso sobre PDF.*?\]/gi, '')
    .replace(/\[Erro ao processar.*?\]/gi, '')
    .replace(/Nota:.*?implementação futura\./gi, '')
    .replace(/requer processamento adicional\./gi, '')
    .replace(/Para usar este conteúdo.*?primeiro\./gi, '')
    .trim()

  // Se não sobrou conteúdo válido, não incluir no prompt
  if (!cleanedKnowledge || cleanedKnowledge.length === 0) {
    return originalPrompt
  }

  // Limitar tamanho do conhecimento (para não exceder limites de tokens)
  const maxKnowledgeChars = 50000 // ~50KB de texto
  const truncatedKnowledge = cleanedKnowledge.length > maxKnowledgeChars
    ? cleanedKnowledge.substring(0, maxKnowledgeChars) + '\n\n[... conteúdo truncado para evitar limite de tokens ...]'
    : cleanedKnowledge

  return `${originalPrompt}

## BASE DE CONHECIMENTO DISPONÍVEL

O agente tem acesso às seguintes informações da base de conhecimento:

${truncatedKnowledge}

IMPORTANTE: Use essas informações como contexto principal para responder perguntas do usuário. Se a pergunta estiver relacionada ao conteúdo dos arquivos, faça referência direta às informações fornecidas e use-as para criar respostas precisas, detalhadas e fundamentadas. NÃO mencione que houve problemas ao processar os arquivos - simplesmente use o conteúdo disponível como se fosse completo e confiável.`
}

