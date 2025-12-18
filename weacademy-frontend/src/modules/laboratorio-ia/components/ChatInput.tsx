'use client'

import { useState, useRef, KeyboardEvent, DragEvent, ClipboardEvent, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Send, Loader2, Image as ImageIcon, X, File, Video, Mic, FileText, Paperclip } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'
import Image from 'next/image'
import { cn } from '@/lib/utils'

export interface Attachment {
  url: string
  type: 'image' | 'video' | 'audio' | 'document'
  name: string
  size: number
  mimeType?: string // Tipo MIME do arquivo (ex: 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  previewUrl?: string // URL local para preview antes do upload
  uploading?: boolean // Indica se o arquivo está sendo enviado
  uploadProgress?: number // Progresso do upload em percentual (0-100)
}

interface ChatInputProps {
  onSend: (message: string, attachments?: Attachment[]) => void
  loading?: boolean
  disabled?: boolean
  provider?: string
  model?: string
  onTextChange?: (text: string) => void  // Callback para quando texto muda (para buscar recomendações)
  onModelChange?: (provider: string, model: string) => void  // Callback para mudança automática de modelo
}

export function ChatInput({
  onSend,
  loading = false,
  disabled = false,
  provider = 'OpenAI',
  model = 'gpt-5-nano',
  onTextChange,
  onModelChange,
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
  const modelSupportsText = currentModel?.capabilities?.input.includes('text') ?? true // Texto é suportado por padrão

  // Função para encontrar modelo compatível com o tipo de arquivo
  const findCompatibleModel = (fileType: 'image' | 'video' | 'audio' | 'document'): { provider: string; model: string } | null => {
    // Para documentos (PDF, Word, Excel, etc.), usar modelos que suportam texto
    // Preferir modelos que também suportam imagem (melhor para PDFs)
    if (fileType === 'document') {
      // Primeiro tentar encontrar modelo que suporta texto E imagem (melhor para PDFs)
      let compatibleModel = AVAILABLE_MODELS.find(m =>
        m.capabilities?.input.includes('text') && m.capabilities?.input.includes('image')
      )
      // Se não encontrar, usar qualquer modelo que suporta texto
      if (!compatibleModel) {
        compatibleModel = AVAILABLE_MODELS.find(m =>
          m.capabilities?.input.includes('text')
        )
      }
      return compatibleModel ? { provider: compatibleModel.provider, model: compatibleModel.model } : null
    }

    // Para outros tipos, encontrar modelo que suporta o tipo específico
    // Priorizar modelos mais adequados para cada tipo
    let compatibleModel = null

    if (fileType === 'image') {
      // Para imagens, preferir modelos que suportam texto E imagem (multimodal)
      compatibleModel = AVAILABLE_MODELS.find(m =>
        m.capabilities?.input.includes('image') && m.capabilities?.input.includes('text')
      )
      // Se não encontrar multimodal, usar qualquer que suporte imagem
      if (!compatibleModel) {
        compatibleModel = AVAILABLE_MODELS.find(m =>
          m.capabilities?.input.includes('image')
        )
      }
    } else if (fileType === 'video') {
      // Para vídeos, procurar modelos que suportam vídeo
      compatibleModel = AVAILABLE_MODELS.find(m =>
        m.capabilities?.input.includes('video')
      )
    } else if (fileType === 'audio') {
      // Para áudio, procurar modelos especializados em transcrição primeiro
      compatibleModel = AVAILABLE_MODELS.find(m =>
        m.model.includes('transcribe') || m.model.includes('transcription')
      )
      // Se não encontrar especializado, usar qualquer que suporte áudio
      if (!compatibleModel) {
        compatibleModel = AVAILABLE_MODELS.find(m =>
          m.capabilities?.input.includes('audio')
        )
      }
    }

    return compatibleModel ? { provider: compatibleModel.provider, model: compatibleModel.model } : null
  }

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
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

    // Tipos MIME permitidos
    const documentMimeTypes = [
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain', // .txt
      'text/csv', // .csv
      'application/rtf', // .rtf
    ]

    // Validar arquivos e criar previews locais
    for (const file of fileArray) {
      // Validar tamanho
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: 'Arquivo muito grande',
          description: `${file.name} excede o limite de 50 MB. Tamanho: ${(file.size / (1024 * 1024)).toFixed(2)} MB`,
          variant: 'destructive',
        })
        continue
      }

      // Determinar tipo de arquivo
      let fileType: 'image' | 'video' | 'audio' | 'document' | null = null

      if (file.type.startsWith('image/')) {
        fileType = 'image'
      } else if (file.type.startsWith('video/')) {
        fileType = 'video'
      } else if (file.type.startsWith('audio/')) {
        fileType = 'audio'
      } else if (documentMimeTypes.includes(file.type) || file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf)$/i)) {
        fileType = 'document'
      }

      if (!fileType) {
        toast({
          title: 'Arquivo não suportado',
          description: `${file.name} não é um tipo de arquivo suportado. Tipos permitidos: imagens, PDFs, documentos Word/Excel/PowerPoint, áudios e vídeos.`,
          variant: 'destructive',
        })
        continue
      }

      // Sempre encontrar o modelo mais adequado para o tipo de arquivo
      const compatibleModel = findCompatibleModel(fileType)

      console.log('[ChatInput] Arquivo detectado:', {
        fileName: file.name,
        fileType,
        currentModel: `${provider}:${model}`,
        compatibleModel: compatibleModel ? `${compatibleModel.provider}:${compatibleModel.model}` : null,
      })

      if (!compatibleModel) {
        toast({
          title: 'Tipo não suportado',
          description: `Nenhum modelo disponível suporta ${fileType === 'image' ? 'imagens' : fileType === 'video' ? 'vídeos' : fileType === 'audio' ? 'áudio' : 'documentos'}.`,
          variant: 'destructive',
        })
        continue
      }

      // Verificar se o modelo atual suporta este tipo
      const currentModelSupports =
        (fileType === 'image' && modelSupportsImage) ||
        (fileType === 'video' && modelSupportsVideo) ||
        (fileType === 'audio' && modelSupportsAudio) ||
        (fileType === 'document' && modelSupportsText)

      // Verificar se precisa mudar (se o modelo atual não suporta OU se encontramos um modelo melhor)
      const needsModelChange = !currentModelSupports ||
        (compatibleModel.provider !== provider || compatibleModel.model !== model)

      console.log('[ChatInput] Verificação de mudança de modelo:', {
        currentModelSupports,
        needsModelChange,
        currentProvider: provider,
        currentModel: model,
        compatibleProvider: compatibleModel.provider,
        compatibleModel: compatibleModel.model,
        onModelChangeAvailable: !!onModelChange,
      })

      // Se precisa mudar modelo, fazer isso antes de continuar
      if (needsModelChange && compatibleModel && onModelChange) {
        const modelDisplayName = AVAILABLE_MODELS.find(
          m => m.provider === compatibleModel.provider && m.model === compatibleModel.model
        )?.displayName || compatibleModel.model

        console.log('[ChatInput] Mudando modelo para:', {
          provider: compatibleModel.provider,
          model: compatibleModel.model,
          displayName: modelDisplayName,
        })

        onModelChange(compatibleModel.provider, compatibleModel.model)

        const fileTypeLabel = fileType === 'image' ? 'imagens'
          : fileType === 'video' ? 'vídeos'
            : fileType === 'audio' ? 'áudio'
              : 'documentos'

        toast({
          title: 'Modelo alterado automaticamente',
          description: `Mudando para ${compatibleModel.provider} - ${modelDisplayName} para processar ${fileTypeLabel}.`,
        })
      }

      validFiles.push(file)

      // Criar preview local imediatamente (apenas para imagens)
      const previewUrl = fileType === 'image' ? URL.createObjectURL(file) : undefined

      tempAttachments.push({
        url: '', // Será preenchido após upload
        type: fileType,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        previewUrl,
        uploading: true, // Marcar como sendo enviado
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

        // Atualizar progresso durante upload
        const xhr = new XMLHttpRequest()

        // Criar Promise para upload com progresso
        const uploadPromise = new Promise<{ url: string; name: string; size: number }>((resolve, reject) => {
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const progress = Math.round((e.loaded / e.total) * 100)
              // Atualizar progresso do anexo específico
              setAttachments((prev) => {
                const newAttachments = [...prev]
                const attachmentIndex = newAttachments.findIndex(a => a.name === tempAttachment.name && a.uploading)
                if (attachmentIndex !== -1) {
                  newAttachments[attachmentIndex] = {
                    ...newAttachments[attachmentIndex],
                    uploadProgress: progress,
                  }
                }
                return newAttachments
              })
            }
          })

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              const result = JSON.parse(xhr.responseText)
              resolve(result)
            } else {
              const error = JSON.parse(xhr.responseText)
              reject(new Error(error.error || 'Erro ao fazer upload'))
            }
          })

          xhr.addEventListener('error', () => {
            reject(new Error('Erro ao fazer upload'))
          })

          xhr.open('POST', '/api/lab-ia/chat/upload')
          xhr.setRequestHeader('Authorization', `Bearer ${token}`)
          xhr.send(formDataObj)
        })

        const result = await uploadPromise

        // Limpar preview local
        if (tempAttachment.previewUrl) {
          URL.revokeObjectURL(tempAttachment.previewUrl)
        }

        uploadedAttachments.push({
          url: result.url,
          type: tempAttachment.type,
          name: result.name || file.name,
          size: result.size || file.size,
          mimeType: file.type,
          uploading: false, // Upload concluído
          uploadProgress: 100,
        })
      }

      // Substituir previews temporários pelas URLs reais
      setAttachments((prev) => {
        const newAttachments = [...prev]
        // Atualizar os anexos que foram enviados
        uploadedAttachments.forEach((uploaded, idx) => {
          const tempIndex = newAttachments.length - tempAttachments.length + idx
          if (tempIndex >= 0 && tempIndex < newAttachments.length) {
            newAttachments[tempIndex] = uploaded
          }
        })
        return newAttachments
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
          // Tentar encontrar modelo compatível
          const compatibleModel = findCompatibleModel('image')
          if (compatibleModel && onModelChange) {
            onModelChange(compatibleModel.provider, compatibleModel.model)
            toast({
              title: 'Modelo alterado automaticamente',
              description: `Mudando para ${compatibleModel.provider} - ${AVAILABLE_MODELS.find(m => m.provider === compatibleModel.provider && m.model === compatibleModel.model)?.displayName || compatibleModel.model} para processar imagens.`,
            })
          } else {
            toast({
              title: 'Modelo não suporta imagens',
              description: `${currentModel?.displayName || 'Este modelo'} não aceita imagens.`,
              variant: 'destructive',
            })
            return
          }
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
          mimeType: file.type,
          previewUrl,
          uploading: true, // Marcar como sendo enviado
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
                mimeType: file.type,
                uploading: false, // Upload concluído
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
            return prev.filter(a => a.previewUrl !== previewUrl || a.uploading)
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
                className={cn(
                  "relative group border rounded-lg overflow-hidden bg-muted/50 transition-opacity",
                  attachment.uploading && "opacity-70"
                )}
              >
                {/* Overlay de loading com progresso */}
                {attachment.uploading && (
                  <div className="absolute inset-0 bg-background/90 flex flex-col items-center justify-center z-10 rounded-lg p-2">
                    <Loader2 className="h-6 w-6 animate-spin text-primary mb-2" />
                    <span className="text-xs font-medium text-foreground mb-1">
                      {attachment.uploadProgress !== undefined
                        ? `${attachment.uploadProgress}%`
                        : 'Enviando...'}
                    </span>
                    {attachment.uploadProgress !== undefined && (
                      <Progress
                        value={attachment.uploadProgress}
                        className="w-full h-1.5 max-w-[80px]"
                      />
                    )}
                  </div>
                )}

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
                {attachment.type === 'document' && (
                  <div className="w-24 h-24 flex flex-col items-center justify-center bg-muted p-2">
                    <FileText className="h-8 w-8 text-muted-foreground mb-1" />
                    <span className="text-xs text-muted-foreground truncate w-full text-center">
                      {attachment.name.length > 15 ? attachment.name.substring(0, 12) + '...' : attachment.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(attachment.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                )}
                <button
                  onClick={() => removeAttachment(index)}
                  disabled={attachment.uploading}
                  className={cn(
                    "absolute top-1 right-1 rounded-full bg-destructive text-destructive-foreground p-1 opacity-0 group-hover:opacity-100 transition-opacity",
                    attachment.uploading && "opacity-0 cursor-not-allowed"
                  )}
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
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf"
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
              <Paperclip className="h-5 w-5" />
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
                loading
                  ? "Aguardando resposta..."
                  : attachments.length > 0
                    ? "Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
                    : "Digite sua mensagem... (Enter para enviar, Shift+Enter para nova linha)"
              }
              rows={1}
              disabled={loading || disabled || uploading}
              readOnly={loading}
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
            className="h-[52px] px-6 relative"
          >
            {loading ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                <span className="text-sm">Enviando...</span>
              </>
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
        <p className="text-xs text-center text-muted-foreground mt-2">
          Enter para enviar | Shift + Enter para nova linha | Cole imagens ou arraste arquivos (máx. 50 MB por arquivo)
        </p>
      </form>
    </div>
  )
}
