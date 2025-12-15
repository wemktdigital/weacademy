'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Image as ImageIcon, Upload, Download, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function BackgroundRemoverPage() {
  const [imageUrl, setImageUrl] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione um arquivo de imagem')
      return
    }

    setUploadedFile(file)
    const reader = new FileReader()
    reader.onload = () => {
      setPreviewUrl(reader.result as string)
    }
    reader.readAsDataURL(file)
    setResultUrl(null)
  }

  const handleRemoveBackground = async () => {
    if (!imageUrl && !uploadedFile) {
      toast.error('Por favor, forneça uma URL de imagem ou faça upload de um arquivo')
      return
    }

    setProcessing(true)
    setResultUrl(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Se tiver arquivo, fazer upload primeiro
      let finalImageUrl = imageUrl

      if (uploadedFile && previewUrl) {
        // Por enquanto, usar data URL
        // TODO: Implementar upload para Supabase Storage
        finalImageUrl = previewUrl
      }

      if (!finalImageUrl) {
        throw new Error('URL da imagem não disponível')
      }

      const response = await fetch('/api/lab-ia/image/remove-background', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          imageUrl: finalImageUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao processar imagem')
      }

      const data = await response.json()

      if (data.success && data.output) {
        setResultUrl(typeof data.output === 'string' ? data.output : data.output[0])
        toast.success(`Fundo removido! Tempo: ${data.processingTime}ms`)
      } else {
        throw new Error('Erro ao processar imagem')
      }
    } catch (error: any) {
      console.error('Erro ao remover fundo:', error)
      toast.error(error.message || 'Erro ao remover fundo da imagem')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return

    const link = document.createElement('a')
    link.href = resultUrl
    link.download = 'imagem-sem-fundo.png'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleClear = () => {
    setImageUrl('')
    setUploadedFile(null)
    setPreviewUrl(null)
    setResultUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Remover Fundo de Imagem</h1>
        <p className="text-muted-foreground mt-1">
          Remova o fundo de imagens usando IA (Powered by Replicate)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carregar Imagem</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL da Imagem</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://exemplo.com/imagem.jpg"
                value={imageUrl}
                onChange={(e) => {
                  setImageUrl(e.target.value)
                  setUploadedFile(null)
                  setPreviewUrl(null)
                }}
                disabled={processing || !!uploadedFile}
              />
              {imageUrl && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setImageUrl('')
                    setPreviewUrl(null)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Ou</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Upload de Arquivo</Label>
            <div className="flex items-center gap-2">
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                disabled={processing || !!imageUrl}
                className="cursor-pointer"
              />
              {uploadedFile && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setUploadedFile(null)
                    setPreviewUrl(null)
                    if (fileInputRef.current) {
                      fileInputRef.current.value = ''
                    }
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
            {uploadedFile && (
              <p className="text-sm text-muted-foreground">
                Arquivo selecionado: {uploadedFile.name} ({(uploadedFile.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          <Button
            onClick={handleRemoveBackground}
            disabled={processing || (!imageUrl && !uploadedFile)}
            className="w-full"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Remover Fundo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview e Resultado */}
      {(previewUrl || imageUrl || resultUrl) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Imagem Original */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Imagem Original</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                {(previewUrl || imageUrl) ? (
                  <img
                    src={previewUrl || imageUrl}
                    alt="Original"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <ImageIcon className="h-12 w-12 text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Imagem Processada */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {resultUrl ? (
                <>
                  <div className="relative w-full aspect-square bg-muted rounded-lg overflow-hidden">
                    <img
                      src={resultUrl}
                      alt="Sem fundo"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <Button
                    onClick={handleDownload}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Imagem
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-center h-full aspect-square bg-muted rounded-lg">
                  <div className="text-center">
                    <ImageIcon className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Clique em "Remover Fundo" para processar
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sobre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Esta ferramenta usa o modelo <strong>851-labs/background-remover</strong> do Replicate
            para remover fundos de imagens automaticamente.
          </p>
          <p>
            <strong>Custo aproximado:</strong> $0.00039 por imagem (~2564 imagens por $1)
          </p>
          <p>
            <strong>Tempo médio:</strong> ~2 segundos por imagem
          </p>
          <p>
            <strong>Hardware:</strong> NVIDIA T4 GPU
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

