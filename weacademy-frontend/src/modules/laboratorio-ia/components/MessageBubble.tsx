'use client'

import { User, Bot, Copy, Check, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface MessageBubbleProps {
  id?: string
  role: 'user' | 'assistant'
  content: string
  timestamp?: string
  isFavorite?: boolean
  onToggleFavorite?: (messageId: string, isFavorite: boolean) => void
}

export function MessageBubble({ id, role, content, timestamp, isFavorite = false, onToggleFavorite }: MessageBubbleProps) {
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
          {timestamp && (
            <span className="text-xs text-muted-foreground">
              {new Date(timestamp).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          )}
        </div>
        
        <div className="prose prose-sm dark:prose-invert max-w-none">
          {isUser ? (
            <p className="whitespace-pre-wrap">{content}</p>
          ) : (
            <ReactMarkdown
              components={{
                code: ({ node, inline, className, children, ...props }: any) => {
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <pre className="bg-muted p-4 rounded-lg overflow-x-auto">
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  ) : (
                    <code className="bg-muted px-1.5 py-0.5 rounded text-sm" {...props}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {content}
            </ReactMarkdown>
          )}
        </div>
        
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
