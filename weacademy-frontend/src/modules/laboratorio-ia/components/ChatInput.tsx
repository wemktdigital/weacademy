'use client'

import { useState, KeyboardEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2 } from 'lucide-react'

interface ChatInputProps {
  onSend: (message: string) => void
  loading?: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, loading = false, disabled = false }: ChatInputProps) {
  const [message, setMessage] = useState('')

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if (!message.trim() || loading || disabled) return
    
    onSend(message.trim())
    setMessage('')
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
    // Shift+Enter permite nova linha
  }

  return (
    <form onSubmit={handleSubmit} className="border-t bg-background p-4">
      <div className="flex items-end gap-2 max-w-3xl mx-auto">
        <div className="flex-1 relative">
                      <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
            rows={1}
            disabled={loading || disabled}
            className="w-full resize-none rounded-lg border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            style={{
              minHeight: '52px',
              maxHeight: '200px',
              height: 'auto',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = `${Math.min(target.scrollHeight, 200)}px`
            }}
          />
        </div>
        <Button
          type="submit"
          disabled={!message.trim() || loading || disabled}
          size="default"
          className="h-[52px] px-6"
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      <p className="text-xs text-center text-muted-foreground mt-2">
        Enter para enviar | Shift + Enter para nova linha
      </p>
    </form>
  )
}
