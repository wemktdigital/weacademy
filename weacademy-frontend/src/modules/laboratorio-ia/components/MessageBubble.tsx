'use client'

import { User, Bot, Copy, Check, Star, Image as ImageIcon, Video, Mic, Download, Sparkles, ThumbsUp, ThumbsDown, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
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
  }
  isFavorite?: boolean
  onToggleFavorite?: (messageId: string, isFavorite: boolean) => void
  attachments?: Attachment[]
  onProvideFeedback?: (feedback: 'positive' | 'negative') => void
  isFeedbackSubmitting?: boolean
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
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)

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
            {isUser ? 'Você' : 'Assistente IA'}
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
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                // Headers
                h1: ({node, ...props}) => <h1 className="text-2xl font-bold mb-3 mt-4 first:mt-0" {...props} />,
                h2: ({node, ...props}) => <h2 className="text-xl font-bold mb-2 mt-3 first:mt-0" {...props} />,
                h3: ({node, ...props}) => <h3 className="text-lg font-semibold mb-2 mt-2 first:mt-0" {...props} />,
                h4: ({node, ...props}) => <h4 className="text-base font-semibold mb-1 mt-2 first:mt-0" {...props} />,
                // Paragraphs
                p: ({node, ...props}) => <p className="mb-3 text-[0.9375rem] leading-6 last:mb-0" {...props} />,
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
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
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
          <div className="flex gap-2 mt-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8"
              onClick={handleCopy}
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
              >
                <Star className={`h-4 w-4 mr-1 ${isFavorite ? 'fill-yellow-400 text-yellow-400' : ''}`} />
                {isFavorite ? 'Favorita' : 'Favoritar'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
