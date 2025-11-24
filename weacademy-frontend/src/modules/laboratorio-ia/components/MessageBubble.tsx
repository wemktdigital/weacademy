'use client'

import { User, Bot, Copy, Check, Star, Image as ImageIcon, Video, Mic, Download, Sparkles, ThumbsUp, ThumbsDown, Loader2, RefreshCw, Clock, Brain, RotateCcw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import { Button } from '@/components/ui/button'
import { useState, useEffect, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import Image from 'next/image'
import { Attachment } from './ChatInput'

interface MessageBubbleProps {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  metadata?: {
    provider?: string
    model?: string
    autoSelected?: boolean
    originalProvider?: string
    originalModel?: string
    taskCategory?: string | null
    feedback?: 'positive' | 'negative'
    memoriesUsed?: string[] // Chaves das memórias usadas
  }
  isFavorite?: boolean
  onToggleFavorite?: (messageId: string, isFavorite: boolean) => void
  attachments?: Attachment[]
  onProvideFeedback?: (feedback: 'positive' | 'negative') => void
  isFeedbackSubmitting?: boolean
  pendingVideoOperation?: {
    id: string
    status: 'pending' | 'processing'
    model: string
    created_at: string
  }
  onCheckVideoStatus?: () => void
  isCheckingVideoStatus?: boolean
  onRegenerate?: () => void
  isRegenerating?: boolean
}

export function MessageBubble({ 
  id, 
  role, 
  content, 
  timestamp,
  metadata,
  isFavorite = false, 
  onToggleFavorite,
  attachments,
  onProvideFeedback,
  isFeedbackSubmitting = false,
  pendingVideoOperation,
  onCheckVideoStatus,
  isCheckingVideoStatus = false,
  onRegenerate,
  isRegenerating = false,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [blobUrl, setBlobUrl] = useState<string | null>(null)

  // Extrair URLs de imagem e vídeo do conteúdo (suporta tanto base64 quanto URLs HTTP)
  // Alguns modelos podem gerar múltiplas imagens ou vídeos
  const { imageUrls, videoUrls, contentWithoutMedia } = useMemo(() => {
    if (role === 'user' || (!content.includes('![Imagem') && !content.includes('![Vídeo'))) {
      return { imageUrls: [], videoUrls: [], contentWithoutMedia: content }
    }

    // Tentar encontrar todas as URLs de imagem com diferentes padrões
    // Suporta tanto data URLs (base64) quanto URLs HTTP (Replicate)
    const imagePatterns = [
      /!\[Imagem\s?gerada\]\((data:image\/[^)]+)\)/g,  // Base64 (OpenAI)
      /!\[Imagemgerada\]\((data:image\/[^)]+)\)/g,     // Base64 sem espaço (OpenAI)
      /!\[Imagem\s?gerada\]\((https?:\/\/[^)]+)\)/g,   // HTTP/HTTPS (Replicate)
      /!\[Imagemgerada\]\((https?:\/\/[^)]+)\)/g,     // HTTP/HTTPS sem espaço (Replicate)
      /!\[Imagem\s?\d+\]\((https?:\/\/[^)]+)\)/g,     // Múltiplas imagens (Replicate)
    ]
    
    // Tentar encontrar todas as URLs de vídeo (suporta base64 e HTTP/HTTPS)
    const videoPatterns = [
      /!\[Vídeo\s?gerado\]\((data:video\/[^)]+)\)/g,  // Base64 (VEO 3.1)
      /!\[Vídeogerado\]\((data:video\/[^)]+)\)/g,     // Base64 sem espaço (VEO 3.1)
      /!\[Vídeo\s?gerado\]\((https?:\/\/[^)]+)\)/g,   // HTTP/HTTPS (Replicate)
      /!\[Vídeogerado\]\((https?:\/\/[^)]+)\)/g,     // HTTP/HTTPS sem espaço (Replicate)
      /!\[Vídeo\s?\d+\]\((https?:\/\/[^)]+)\)/g,     // Múltiplos vídeos (Replicate)
    ]
    
    let allImageMatches: string[] = []
    let allVideoMatches: string[] = []
    let contentWithoutMedia = content
    
    // Testar todos os padrões de imagem para capturar todas as imagens
    for (const pattern of imagePatterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        if (match[1] && !allImageMatches.includes(match[1])) {
          allImageMatches.push(match[1])
          // Remover esta imagem do conteúdo markdown
          contentWithoutMedia = contentWithoutMedia.replace(match[0], '').trim()
        }
      }
    }

    // Testar todos os padrões de vídeo para capturar todos os vídeos
    for (const pattern of videoPatterns) {
      const matches = content.matchAll(pattern)
      for (const match of matches) {
        if (match[1] && !allVideoMatches.includes(match[1])) {
          allVideoMatches.push(match[1])
          // Remover este vídeo do conteúdo markdown
          contentWithoutMedia = contentWithoutMedia.replace(match[0], '').trim()
        }
      }
    }

    if (allImageMatches.length > 0 || allVideoMatches.length > 0) {
      console.log('[MessageBubble] URLs de mídia extraídas:', {
        images: {
          count: allImageMatches.length,
          urls: allImageMatches.map(url => ({
            urlType: url.startsWith('data:') ? 'base64' : url.startsWith('http') ? 'http' : 'unknown',
            urlLength: url.length,
            urlStart: url.substring(0, 100),
          })),
        },
        videos: {
          count: allVideoMatches.length,
          urls: allVideoMatches.map(url => ({
            urlType: url.startsWith('http') ? 'http' : 'unknown',
            urlLength: url.length,
            urlStart: url.substring(0, 100),
          })),
        },
      })
      
      return { imageUrls: allImageMatches, videoUrls: allVideoMatches, contentWithoutMedia }
    }

    return { imageUrls: [], videoUrls: [], contentWithoutMedia: content }
  }, [content, role])
  
  // Para compatibilidade, usar primeira imagem como imageUrl
  const imageUrl = imageUrls.length > 0 ? imageUrls[0] : null

  // Criar Blob URL para imagens muito grandes (> 1MB) - apenas para data URLs
  // URLs HTTP não precisam de Blob URL, podem ser usadas diretamente
  useEffect(() => {
    let currentBlobUrl: string | null = null
    
    // Apenas criar Blob URL para data URLs muito grandes
    if (imageUrl && imageUrl.startsWith('data:') && imageUrl.length > 1000000) {
      console.log('[MessageBubble] Criando Blob URL para imagem base64 grande...')
      // Converter data URL para Blob
      fetch(imageUrl)
        .then(res => res.blob())
        .then(blob => {
          const url = URL.createObjectURL(blob)
          console.log('[MessageBubble] Blob URL criada:', url)
          currentBlobUrl = url
          setBlobUrl(url)
        })
        .catch(err => {
          console.error('[MessageBubble] Erro ao criar Blob URL:', err)
          setBlobUrl(null)
        })
    } else {
      // Para URLs HTTP ou data URLs pequenas, não precisa de Blob URL
      setBlobUrl(null)
    }

    // Cleanup: revogar Blob URL quando componente desmontar ou imagem mudar
    return () => {
      if (currentBlobUrl) {
        URL.revokeObjectURL(currentBlobUrl)
      }
      // Também revogar blobUrl anterior se existir
      setBlobUrl(prev => {
        if (prev && prev !== currentBlobUrl) {
          URL.revokeObjectURL(prev)
        }
        return null
      })
    }
  }, [imageUrl])

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleToggleFavorite = () => {
    if (id && onToggleFavorite) {
      onToggleFavorite(id, !isFavorite)
    }
  }

  const isUser = role === 'user'
  
  // Determinar qual URL usar para renderização
  const finalImageUrl = blobUrl || imageUrl

  return (
    <div className={`flex gap-4 p-4 ${isUser ? 'bg-background' : 'bg-muted/30'}`}>
      <div className="flex-shrink-0">
        {isUser ? (
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
            <User className="h-5 w-5 text-primary-foreground" />
          </div>
        ) : (
          <div className="h-8 w-8 rounded-full bg-secondary flex items-center justify-center">
            <Bot className="h-5 w-5" />
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-semibold">
            {isUser ? 'Você' : 'WE IA'}
          </span>
          {metadata?.autoSelected && (
            <Badge variant="secondary" className="text-xs gap-1">
              <Sparkles className="h-3 w-3" />
              Modelo escolhido automaticamente
            </Badge>
          )}
          {metadata?.model && !metadata.autoSelected && (
            <Badge variant="outline" className="text-xs">
              {AVAILABLE_MODELS.find(m => m.provider === metadata.provider && m.model === metadata.model)?.displayName || metadata.model}
            </Badge>
          )}
          {metadata?.memoriesUsed && metadata.memoriesUsed.length > 0 && (
            <Badge 
              variant="secondary" 
              className="text-xs gap-1"
              title={`Memórias usadas: ${metadata.memoriesUsed.join(', ')}`}
            >
              <Brain className="h-3 w-3" />
              Usando memórias
            </Badge>
          )}
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {new Date(timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>

        {/* Exibir attachments */}
        {attachments && attachments.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="relative group border rounded-lg overflow-hidden bg-muted/50"
              >
                {attachment.type === 'image' && (
                  <div className="relative w-48 h-48">
                    <Image
                      src={attachment.url}
                      alt={attachment.name}
                      fill
                      className="object-cover"
                    />
                  </div>
                )}
                {attachment.type === 'video' && (
                  <div className="w-48 h-48 flex flex-col items-center justify-center bg-muted p-4">
                    <Video className="h-12 w-12 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground text-center truncate w-full">
                      {attachment.name}
                    </span>
                  </div>
                )}
                {attachment.type === 'audio' && (
                  <div className="w-48 h-24 flex flex-col items-center justify-center bg-muted p-4">
                    <Mic className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-xs text-muted-foreground text-center truncate w-full">
                      {attachment.name}
                    </span>
                  </div>
                )}
                <a
                  href={attachment.url}
                  download={attachment.name}
                  className="absolute top-2 right-2 rounded-full bg-background/80 backdrop-blur-sm p-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Baixar arquivo"
                >
                  <Download className="h-4 w-4" />
                </a>
              </div>
            ))}
          </div>
        )}
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <>
              {/* Renderizar imagens diretamente se encontradas */}
              {imageUrls.length > 0 && (
                <div className="my-4 space-y-4">
                  {imageUrls.map((url, index) => {
                    const isHttpUrl = url.startsWith('http://') || url.startsWith('https://')
                    const isDataUrl = url.startsWith('data:')
                    const isLargeBase64 = isDataUrl && url.length > 1000000
                    const useBlobUrl = index === 0 && blobUrl && isLargeBase64 // Apenas primeira imagem usa blobUrl se disponível
                    
                    return (
                      <div key={index} className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden border border-border">
                        {useBlobUrl ? (
                          // Usar Blob URL para primeira imagem base64 muito grande
                          <img
                            src={blobUrl}
                            alt={`Imagem gerada ${index + 1}`}
                            className="w-full h-auto"
                            onError={(e) => {
                              console.error('[MessageBubble] Erro ao carregar imagem (Blob URL):', {
                                blobUrl,
                                error: e,
                              })
                            }}
                            onLoad={() => {
                              console.log('[MessageBubble] Imagem carregada com sucesso (Blob URL)!')
                            }}
                          />
                        ) : isHttpUrl ? (
                          // Usar Next.js Image para URLs HTTP (Replicate)
                          <Image
                            src={url}
                            alt={`Imagem gerada ${index + 1}`}
                            width={1024}
                            height={1024}
                            className="w-full h-auto"
                            unoptimized={true}
                            onError={(e) => {
                              console.error('[MessageBubble] Erro ao carregar imagem (HTTP URL):', {
                                src: url.substring(0, 200),
                                error: e,
                              })
                            }}
                            onLoad={() => {
                              console.log('[MessageBubble] Imagem carregada com sucesso (HTTP URL)!')
                            }}
                          />
                        ) : isLargeBase64 ? (
                          // Usar <img> nativo para URLs base64 muito longas
                          <img
                            src={url}
                            alt={`Imagem gerada ${index + 1}`}
                            className="w-full h-auto"
                            onError={(e) => {
                              console.error('[MessageBubble] Erro ao carregar imagem (img nativo):', {
                                src: url.substring(0, 200),
                                srcLength: url.length,
                                error: e,
                              })
                            }}
                            onLoad={() => {
                              console.log('[MessageBubble] Imagem carregada com sucesso (img nativo)!')
                            }}
                          />
                        ) : (
                          // Usar Next.js Image para URLs base64 pequenas ou outras URLs
                          <Image
                            src={url}
                            alt={`Imagem gerada ${index + 1}`}
                            width={1024}
                            height={1024}
                            className="w-full h-auto"
                            unoptimized={true}
                            onError={(e) => {
                              console.error('[MessageBubble] Erro ao carregar imagem (Next.js Image):', {
                                src: url.substring(0, 200),
                                srcLength: url.length,
                                error: e,
                              })
                            }}
                            onLoad={() => {
                              console.log('[MessageBubble] Imagem carregada com sucesso (Next.js Image)!')
                            }}
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
              
              {/* Renderizar vídeos diretamente se encontrados */}
              {videoUrls.length > 0 && (
                <div className="my-4 space-y-4">
                  {videoUrls.map((url, index) => (
                    <div key={index} className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden border border-border">
                      <video
                        src={url}
                        controls
                        className="w-full h-auto"
                        preload="metadata"
                        onError={(e) => {
                          console.error('[MessageBubble] Erro ao carregar vídeo:', {
                            src: url.substring(0, 200),
                            error: e,
                          })
                        }}
                        onLoadedMetadata={() => {
                          console.log('[MessageBubble] Vídeo carregado com sucesso!')
                        }}
                      >
                        Seu navegador não suporta a tag de vídeo.
                      </video>
                    </div>
                  ))}
                </div>
              )}
              
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[]}
                components={{
                  // Customizar renderização de imagens no markdown (caso alguma não tenha sido extraída)
                  img: ({node, src, alt, ...props}: any) => {
                    // Se já renderizamos esta imagem/vídeo diretamente, não renderizar novamente
                    if (src && (imageUrls.includes(src) || videoUrls.includes(src))) {
                      return null
                    }
                    // Renderizar imagem normalmente se não foi extraída
                    return <img src={src} alt={alt} className="max-w-full h-auto rounded-lg" {...props} />
                  },
                // Headers
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-3 mt-4 first:mt-0" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-2 mt-3 first:mt-0" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mb-2 mt-2 first:mt-0" {...props} />,
                h4: ({node, ...props}) => <h4 className="text-base font-semibold mb-1 mt-2 first:mt-0" {...props} />,
                // Paragraphs - customizado para permitir divs dentro quando há imagens
                p: ({node, children, ...props}: any) => {
                  // Verificar se há uma imagem dentro deste parágrafo
                  const hasImage = node?.children?.some((child: any) => child.tagName === 'img')
                  if (hasImage) {
                    // Se tem imagem, renderizar sem o <p> wrapper para permitir divs
                    return <div className="mb-3 text-[0.9375rem] leading-6 last:mb-0" {...props}>{children}</div>
                  }
                  return <p className="mb-3 text-[0.9375rem] leading-6 last:mb-0" {...props}>{children}</p>
                },
                // Lists
                ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3 space-y-1" {...props} />,
                ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3 space-y-1" {...props} />,
                li: ({node, ...props}) => <li className="ml-4 mb-1" {...props} />,
                // Bold, italic
                strong: ({node, ...props}) => <strong className="font-semibold" {...props} />,
                em: ({node, ...props}) => <em className="italic" {...props} />,
                // Links
                a: ({node, ...props}) => <a className="text-primary hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                // Code blocks
                code: ({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto mb-3">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono" {...props}>
                      {children}
                    </code>
                  )
                },
                // Blockquotes
                blockquote: ({node, ...props}) => (
                  <blockquote className="border-l-4 border-primary pl-4 my-3 italic text-muted-foreground" {...props} />
                ),
                // Horizontal rule
                hr: ({node, ...props}) => <hr className="my-4 border-muted" {...props} />,
                // Tables
                table: ({node, ...props}) => (
                  <div className="overflow-x-auto my-3">
                    <table className="min-w-full border border-muted rounded" {...props} />
                  </div>
                ),
                th: ({node, ...props}) => (
                  <th className="border border-muted px-4 py-2 font-semibold bg-muted" {...props} />
                ),
                td: ({node, ...props}) => (
                  <td className="border border-muted px-4 py-2" {...props} />
                ),
                // Images - renderizar imagens geradas
                img: ({node, src, alt, ...props}: any) => {
                  if (!src) return null
                  
                  console.log('[MessageBubble] Tentando renderizar imagem:', {
                    srcLength: src?.length,
                    srcStart: src?.substring(0, 100),
                    srcEnd: src?.substring(Math.max(0, src.length - 50)),
                    isDataUrl: src?.startsWith('data:'),
                    isHttp: src?.startsWith('http'),
                  })
                  
                  // Validar URL antes de tentar renderizar
                  let isValidUrl = true
                  let finalSrc = src
                  
                  // Se é base64 sem prefixo data:, adicionar prefixo
                  if (src.startsWith('iVBORw0KGg') || src.startsWith('/9j/')) {
                    const mimeType = src.startsWith('iVBORw0KGg') ? 'image/png' : 'image/jpeg'
                    finalSrc = `data:${mimeType};base64,${src}`
                    console.log('[MessageBubble] Convertido base64 para data URL')
                  } else if (!src.startsWith('data:') && !src.startsWith('http') && !src.startsWith('/')) {
                    // Tentar validar como URL
                    try {
                      new URL(src)
                    } catch (e) {
                      isValidUrl = false
                      console.warn('[MessageBubble] URL de imagem inválida:', src.substring(0, 200))
                    }
                  }
                  
                  // Se URL inválida, retornar null para evitar erro de HTML inválido
                  if (!isValidUrl && !finalSrc.startsWith('data:') && !finalSrc.startsWith('http')) {
                    return null
                  }
                  
                  // Para URLs base64 muito longas (> 1MB), usar <img> nativo ao invés de Next.js Image
                  // O Next.js Image pode ter problemas com URLs muito longas
                  const isLongBase64 = finalSrc.startsWith('data:') && finalSrc.length > 1000000
                  
                  // Retornar div diretamente - o componente p customizado vai renderizar como div quando detectar imagem
                  return (
                    <div className="my-4">
                      <div className="relative w-full max-w-2xl mx-auto rounded-lg overflow-hidden border border-border">
                        {isLongBase64 ? (
                          // Usar <img> nativo para URLs base64 muito longas
                          <img
                            src={finalSrc}
                            alt={alt || 'Imagem gerada'}
                            className="w-full h-auto"
                            onError={(e) => {
                              console.error('[MessageBubble] Erro ao carregar imagem (img nativo):', {
                                src: finalSrc.substring(0, 200),
                                srcLength: finalSrc.length,
                                error: e,
                              })
                              const target = e.target as HTMLImageElement
                              const parent = target.parentElement
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="p-4 border border-destructive rounded-lg bg-destructive/10">
                                    <div class="text-sm text-destructive">Erro ao carregar imagem</div>
                                    <div class="text-xs text-muted-foreground mt-1 break-all">URL muito longa (${(finalSrc.length / 1024 / 1024).toFixed(2)} MB)</div>
                                  </div>
                                `
                              }
                            }}
                            onLoad={() => {
                              console.log('[MessageBubble] Imagem carregada com sucesso (img nativo)!')
                            }}
                          />
                        ) : (
                          // Usar Next.js Image para URLs normais
                          <Image
                            src={finalSrc}
                            alt={alt || 'Imagem gerada'}
                            width={1024}
                            height={1024}
                            className="w-full h-auto"
                            unoptimized={true} // Sempre desabilitar otimização para data URLs e URLs externas
                            onError={(e) => {
                              console.error('[MessageBubble] Erro ao carregar imagem (Next.js Image):', {
                                src: finalSrc.substring(0, 200),
                                srcLength: finalSrc.length,
                                error: e,
                              })
                              // Substituir por mensagem de erro usando React
                              const target = e.target as HTMLImageElement
                              const parent = target.parentElement?.parentElement
                              if (parent) {
                                parent.innerHTML = `
                                  <div class="p-4 border border-destructive rounded-lg bg-destructive/10">
                                    <div class="text-sm text-destructive">Erro ao carregar imagem</div>
                                    <div class="text-xs text-muted-foreground mt-1 break-all">${finalSrc.substring(0, 100)}</div>
                                  </div>
                                `
                              }
                            }}
                            onLoad={() => {
                              console.log('[MessageBubble] Imagem carregada com sucesso (Next.js Image)!')
                            }}
                          />
                        )}
                      </div>
                    </div>
                  )
                },
              }}
              >
                {contentWithoutMedia}
              </ReactMarkdown>
            </>
          )}
        </div>
        {/* Indicador de operação de vídeo pendente */}
        {!isUser && pendingVideoOperation && (
          <div className="mt-3 flex flex-col gap-2 border-t border-muted pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm">
                {pendingVideoOperation.status === 'processing' ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Clock className="h-4 w-4 text-muted-foreground" />
                )}
                <span className={pendingVideoOperation.status === 'processing' ? 'text-primary font-medium' : 'text-muted-foreground'}>
                  {pendingVideoOperation.status === 'processing' 
                    ? 'Processando vídeo...' 
                    : 'Vídeo em fila de processamento'}
                </span>
                <Badge variant="outline" className="text-xs">
                  {pendingVideoOperation.model.includes('fast') ? 'VEO 3.1 Fast' : 'VEO 3.1'}
                </Badge>
              </div>
              {onCheckVideoStatus && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onCheckVideoStatus}
                  disabled={isCheckingVideoStatus}
                  className="gap-2"
                >
                  {isCheckingVideoStatus ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Verificando...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5" />
                      Verificar status
                    </>
                  )}
                </Button>
              )}
            </div>
            <div className="text-xs text-muted-foreground">
              Iniciado em {new Date(pendingVideoOperation.created_at).toLocaleString('pt-BR')}
            </div>
          </div>
        )}

        {!isUser && metadata?.autoSelected && onProvideFeedback && (
          <div className="mt-3 flex flex-col gap-2 border-t border-muted pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              <span>
                Este modelo foi escolhido automaticamente
                {metadata.taskCategory ? ` · ${metadata.taskCategory}` : ''}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-muted-foreground">O resultado foi útil?</span>
              <div className="flex items-center gap-2">
                <Button
                  variant={metadata.feedback === 'positive' ? 'default' : 'outline'}
                  size="sm"
                  disabled={isFeedbackSubmitting || !!metadata.feedback}
                  onClick={() => onProvideFeedback('positive')}
                  className="gap-2"
                >
                  {isFeedbackSubmitting && !metadata.feedback ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="h-4 w-4" />
                  )}
                  Gostei
                </Button>
                <Button
                  variant={metadata.feedback === 'negative' ? 'destructive' : 'outline'}
                  size="sm"
                  disabled={isFeedbackSubmitting || !!metadata.feedback}
                  onClick={() => onProvideFeedback('negative')}
                  className="gap-2"
                >
                  {isFeedbackSubmitting && !metadata.feedback ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsDown className="h-4 w-4" />
                  )}
                  Melhorar
                </Button>
              </div>
              {metadata.feedback && (
                <Badge variant="secondary" className="text-xs">
                  {metadata.feedback === 'positive' ? 'Feedback positivo registrado' : 'Feedback negativo registrado'}
                </Badge>
              )}
            </div>
          </div>
        )}
        
        {!isUser && (
          <div className="flex flex-wrap gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={handleCopy}
              title="Copiar mensagem"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Copiado!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </>
              )}
            </Button>
            {id && onToggleFavorite && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={handleToggleFavorite}
                title={isFavorite ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
              >
                <Star className={`h-4 w-4 mr-1 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {isFavorite ? 'Favorita' : 'Favoritar'}
              </Button>
            )}
            {onRegenerate && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8"
                onClick={onRegenerate}
                disabled={isRegenerating}
                title="Regenerar resposta"
              >
                {isRegenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Regenerando...
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-4 w-4 mr-1" />
                    Regenerar
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
