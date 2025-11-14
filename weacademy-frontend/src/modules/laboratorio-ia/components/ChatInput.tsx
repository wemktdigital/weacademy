'use client'

import { useState, useRef, KeyboardEvent, DragEvent, ClipboardEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Image as ImageIcon, X, File, Video, Mic } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import Image from 'next/image'

export interface Attachment {
  url: string
  type: 'image' | 'video' | 'audio'
  name: string
  size: number
  previewUrl?: string // URL local para preview antes do upload
}

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void
  loading?: boolean
  disabled?: boolean
  provider?: string
  model?: string
  onTextChange?: (text: string) => void  // Callback para quando texto muda (para buscar recomendações)
}

export function ChatInput({ 
  onSend, 
  loading = false, 
  disabled = false,
  provider = 'OpenAI',
  model = 'gpt-5-nano',
  onTextChange,
}: ChatInputProps) {
  const { toast } = useToast()
  const [message, setMessage] = useState('')
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Verificar capacidades do modelo atual
  const currentModel = AVAILABLE_MODELS.find(
    m => m.provider === provider && m.model === model
  )

  const modelSupportsImage = currentModel?.capabilities?.input.includes('image') ?? false
  const modelSupportsVideo = currentModel?.capabilities?.input.includes('video') ?? false
  const modelSupportsAudio = currentModel?.capabilities?.input.includes('audio') ?? false

  // Limpar previews locais ao desmontar componente
  useEffect(() => {
    return () => {
      attachments.forEach(attachment => {
        if (attachment.previewUrl) {
          URL.revokeObjectURL(attachment.previewUrl)
        }
      })
    }
  }, []) // Apenas ao desmontar

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return

    const fileArray = Array.from(files)
    const validFiles: File[] = []
    const tempAttachments: Attachment[] = []

    // Validar arquivos e criar previews locais
    for (const file of fileArray) {
      const fileType = file.type.startsWith('image/') 
        ? 'image' 
        : file.type.startsWith('video/')
        ? 'video'
        : file.type.startsWith('audio/')
        ? 'audio'
        : null

      if (!fileType) {
        toast({
          title: 'Arquivo não suportado',
          description: `${file.name} não é uma imagem, vídeo ou áudio válido.`,
          variant: 'destructive',
        })
        continue
      }

      // Verificar se o modelo suporta este tipo
      if (
        (fileType === 'image' && !modelSupportsImage) ||
        (fileType === 'video' && !modelSupportsVideo) ||
        (fileType === 'audio' && !modelSupportsAudio)
      ) {
        toast({
          title: 'Modelo não suporta este tipo',
          description: `${currentModel?.displayName || 'Este modelo'} não aceita ${fileType === 'image' ? 'imagens' : fileType === 'video' ? 'vídeos' : 'áudio'}.`,
          variant: 'destructive',
        })
        continue
      }

      validFiles.push(file)
      
      // Criar preview local imediatamente
      const previewUrl = fileType === 'image' ? URL.createObjectURL(file) : undefined
      
      tempAttachments.push({
        url: '', // Será preenchido após upload
        type: fileType,
        name: file.name,
        size: file.size,
        previewUrl,
      })
    }

    if (validFiles.length === 0) return

    // Adicionar previews temporários imediatamente
    setAttachments((prev) => [...prev, ...tempAttachments])

    // Upload dos arquivos
    setUploading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const uploadedAttachments: Attachment[] = []

      for (let i = 0; i < validFiles.length; i++) {
        const file = validFiles[i]
        const tempAttachment = tempAttachments[i]
        
        const formDataObj = new FormData()
        formDataObj.append('file', file)

        const response = await fetch('/api/lab-ia/chat/upload', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formDataObj,
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'Erro ao fazer upload')
        }

        const result = await response.json()
        
        // Limpar preview local
        if (tempAttachment.previewUrl) {
          URL.revokeObjectURL(tempAttachment.previewUrl)
        }
        
        uploadedAttachments.push({
          url: result.url,
          type: tempAttachment.type,
          name: result.name || file.name,
          size: result.size || file.size,
        })
      }

      // Substituir previews temporários pelas URLs reais
      setAttachments((prev) => {
        const newAttachments = [...prev]
        // Remover os temporários
        const withoutTemp = newAttachments.slice(0, -tempAttachments.length)
        // Adicionar os uploadados
        return [...withoutTemp, ...uploadedAttachments]
      })
      
      toast({
        title: 'Arquivo(s) anexado(s)',
        description: `${uploadedAttachments.length} arquivo(s) pronto(s) para enviar.`,
      })
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error)
      
      // Remover previews temporários em caso de erro
      setAttachments((prev) => {
        const newAttachments = [...prev]
        tempAttachments.forEach(temp => {
          if (temp.previewUrl) {
            URL.revokeObjectURL(temp.previewUrl)
          }
        })
        return newAttachments.slice(0, -tempAttachments.length)
      })
      
      toast({
        title: 'Erro ao fazer upload',
        description: error.message || 'Não foi possível anexar o arquivo.',
        variant: 'destructive',
      })
    } finally {
      setUploading(false)
    }
  }

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData.items

    for (let i = 0; i < items.length; i++) {
      const item = items[i]

      if (item.type.startsWith('image/')) {
        e.preventDefault()
        
        if (!modelSupportsImage) {
          toast({
            title: 'Modelo não suporta imagens',
            description: `${currentModel?.displayName || 'Este modelo'} não aceita imagens.`,
            variant: 'destructive',
          })
          return
        }

        const file = item.getAsFile()
        if (!file) continue

        // Criar preview local imediatamente
        const previewUrl = URL.createObjectURL(file)
        const tempAttachment: Attachment = {
          url: '',
          type: 'image',
          name: file.name || 'imagem.png',
          size: file.size,
          previewUrl,
        }

        // Adicionar preview temporário
        setAttachments((prev) => [...prev, tempAttachment])

        // Upload do arquivo
        setUploading(true)
        try {
          const { data: sessionData } = await supabase.auth.getSession()
          const token = sessionData?.session?.access_token

          if (!token) {
            throw new Error('Não autenticado')
          }

          const fileList = new DataTransfer()
          fileList.items.add(file)
          
          const formDataObj = new FormData()
          formDataObj.append('file', file)

          const response = await fetch('/api/lab-ia/chat/upload', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            body: formDataObj,
          })

          if (!response.ok) {
            const error = await response.json()
            throw new Error(error.error || 'Erro ao fazer upload')
          }

          const result = await response.json()
          
          // Limpar preview local
          URL.revokeObjectURL(previewUrl)
          
          // Substituir preview temporário pela URL real
          setAttachments((prev) => {
            const newAttachments = [...prev]
            const index = newAttachments.findIndex(a => a.previewUrl === previewUrl)
            if (index !== -1) {
              newAttachments[index] = {
                url: result.url,
                type: 'image',
                name: result.name || file.name,
                size: result.size || file.size,
              }
            }
            return newAttachments
          })
          
          toast({
            title: 'Imagem anexada',
            description: 'Imagem pronta para enviar.',
          })
        } catch (error: any) {
          console.error('Erro ao fazer upload:', error)
          
          // Remover preview temporário em caso de erro
          setAttachments((prev) => {
            URL.revokeObjectURL(previewUrl)
            return prev.filter(a => a.previewUrl !== previewUrl)
          })
          
          toast({
            title: 'Erro ao fazer upload',
            description: error.message || 'Não foi possível anexar a imagem.',
            variant: 'destructive',
          })
        } finally {
          setUploading(false)
        }
      }
    }
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleFileSelect(files)
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const attachment = prev[index]
      // Limpar preview local se existir
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
      }
      return prev.filter((_, i) => i !== index)
    })
  }

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    
    if ((!message.trim() && attachments.length === 0) || loading || disabled) return
    
    // Limpar previews locais antes de enviar
    attachments.forEach(attachment => {
      if (attachment.previewUrl) {
        URL.revokeObjectURL(attachment.previewUrl)
      }
    })
    
    onSend(message.trim(), attachments.length > 0 ? attachments : undefined)
    setMessage('')
    setAttachments([])
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div 
      className="border-t bg-background"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Preview de anexos */}
      {attachments.length > 0 && (
        <div className="px-4 pt-4 pb-2">
          <div className="flex flex-wrap gap-2 max-w-3xl mx-auto">
            {attachments.map((attachment, index) => (
              <div
                key={index}
                className="relative group border rounded-lg overflow-hidden bg-muted/50"
              >
                {attachment.type === 'image' && (
                  <div className="relative w-24 h-24">
                    <Image
                      src={attachment.previewUrl || attachment.url}
                      alt={attachment.name}
                      fill
                      className="object-cover"
                      unoptimized={!!attachment.previewUrl}
                    />
                  </div>
                )}
                {attachment.type === 'video' && (
                  <div className="w-24 h-24 flex items-center justify-center bg-muted">
                    <Video className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                {attachment.type === 'audio' && (
                  <div className="w-24 h-24 flex items-center justify-center bg-muted">
                    <Mic className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(index)}
                  className="absolute top-1 right-1 rounded-full bg-destructive text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-4">
        <div className="flex items-end gap-2 max-w-3xl mx-auto">
          {/* Botão de anexar */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*,audio/*"
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-[52px] w-[52px] flex-shrink-0"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || disabled || uploading}
            title="Anexar arquivo"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <ImageIcon className="h-5 w-5" />
            )}
          </Button>

          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value)
                onTextChange?.(e.target.value) // Notificar mudança de texto
              }}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={
                attachments.length > 0
                  ? "Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                  : "Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              }
              rows={1}
              disabled={loading || disabled || uploading}
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
            disabled={(!message.trim() && attachments.length === 0) || loading || disabled || uploading}
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
          Enter para enviar | Shift + Enter para nova linha | Cole imagens ou arraste arquivos
        </p>
      </form>
    </div>
  )
}
