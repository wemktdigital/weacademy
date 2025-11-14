'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Upload, X, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from '@/hooks/use-toast'

interface ImageUploadProps {
  value?: string
  onChange: (url: string) => void
  onError?: (error: string) => void
}

export function ImageUpload({ value, onChange, onError }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(value || null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      toast({
        title: 'Erro',
        description: 'Apenas imagens (JPG, PNG, WEBP, GIF) são permitidas',
        variant: 'destructive',
      })
      return
    }

    // Validar tamanho (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      toast({
        title: 'Erro',
        description: 'Arquivo muito grande. Máximo 5MB',
        variant: 'destructive',
      })
      return
    }

    setUploading(true)

    try {
      // Obter sessão
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      // Criar FormData
      const formData = new FormData()
      formData.append('file', file)

      // Upload via API
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao fazer upload')
      }

      setPreview(result.url)
      onChange(result.url)

      toast({
        title: 'Sucesso',
        description: 'Imagem enviada com sucesso!',
      })
    } catch (error: any) {
      const errorMsg = error.message || 'Erro ao fazer upload'
      toast({
        title: 'Erro',
        description: errorMsg,
        variant: 'destructive',
      })
      if (onError) onError(errorMsg)
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemove = () => {
    setPreview(null)
    onChange('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      {preview ? (
        <div className="relative aspect-video w-full rounded-lg border overflow-hidden bg-muted">
          <img 
            src={preview} 
            alt="Preview" 
            className="w-full h-full object-cover"
          />
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="absolute top-2 right-2"
            onClick={handleRemove}
            disabled={uploading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div 
          className="aspect-video w-full rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/50 flex items-center justify-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
          onClick={() => fileInputRef.current?.click()}
        >
          <div className="text-center space-y-2">
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
            ) : (
              <>
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Clique para fazer upload de uma imagem
                </p>
                <p className="text-xs text-muted-foreground">
                  JPG, PNG, WEBP ou GIF (max 5MB)
                </p>
              </>
            )}
          </div>
        </div>
      )}
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
        disabled={uploading}
      />
    </div>
  )
}

