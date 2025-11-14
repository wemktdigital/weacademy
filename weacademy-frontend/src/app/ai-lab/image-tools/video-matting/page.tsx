'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Video, Upload, Download, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function VideoMattingPage() {
  const [videoUrl, setVideoUrl] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [processing, setProcessing] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('video/')) {
      toast.error('Por favor, selecione um arquivo de vídeo')
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

  const handleProcessVideo = async () => {
    if (!videoUrl && !uploadedFile) {
      toast.error('Por favor, forneça uma URL de vídeo ou faça upload de um arquivo')
      return
    }

    setProcessing(true)
    setResultUrl(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Se tiver arquivo, fazer upload primeiro
      let finalVideoUrl = videoUrl

      if (uploadedFile && previewUrl) {
        // Por enquanto, usar data URL
        // TODO: Implementar upload para Supabase Storage
        finalVideoUrl = previewUrl
      }

      if (!finalVideoUrl) {
        throw new Error('URL do vídeo não disponível')
      }

      toast.info('Processando vídeo... Isso pode levar alguns minutos.')

      const response = await fetch('/api/lab-ia/video/matting', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          videoUrl: finalVideoUrl,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao processar vídeo')
      }

      const data = await response.json()

      if (data.success && data.output) {
        setResultUrl(data.output)
        toast.success(`Vídeo processado! Tempo: ${(data.processingTime / 1000).toFixed(1)}s`)
      } else {
        throw new Error('Erro ao processar vídeo')
      }
    } catch (error: any) {
      console.error('Erro ao processar vídeo:', error)
      toast.error(error.message || 'Erro ao processar vídeo')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return

    const link = document.createElement('a')
    link.href = resultUrl
    link.download = 'video-sem-fundo.mp4'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleClear = () => {
    setVideoUrl('')
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
        <h1 className="text-3xl font-bold">Processamento de Vídeo - Matting</h1>
        <p className="text-muted-foreground mt-1">
          Extraia o foreground (primeiro plano) de vídeos usando IA (Powered by Replicate)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Carregar Vídeo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL do Vídeo</Label>
            <div className="flex gap-2">
              <Input
                type="url"
                placeholder="https://exemplo.com/video.mp4"
                value={videoUrl}
                onChange={(e) => {
                  setVideoUrl(e.target.value)
                  setUploadedFile(null)
                  setPreviewUrl(null)
                }}
                disabled={processing || !!uploadedFile}
              />
              {videoUrl && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setVideoUrl('')
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
                accept="video/*"
                onChange={handleFileSelect}
                disabled={processing || !!videoUrl}
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
                Arquivo selecionado: {uploadedFile.name} ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>

          <Button
            onClick={handleProcessVideo}
            disabled={processing || (!videoUrl && !uploadedFile)}
            className="w-full"
          >
            {processing ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando... (pode levar alguns minutos)
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Processar Vídeo
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview e Resultado */}
      {(previewUrl || videoUrl || resultUrl) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Vídeo Original */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Vídeo Original</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                {(previewUrl || videoUrl) ? (
                  <video
                    src={previewUrl || videoUrl}
                    controls
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Video className="h-12 w-12 text-muted-foreground opacity-50" />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Vídeo Processado */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Resultado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {resultUrl ? (
                <>
                  <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
                    <video
                      src={resultUrl}
                      controls
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <Button
                    onClick={handleDownload}
                    className="w-full"
                    variant="outline"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Baixar Vídeo
                  </Button>
                </>
              ) : (
                <div className="flex items-center justify-center h-full aspect-video bg-muted rounded-lg">
                  <div className="text-center">
                    <Video className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm text-muted-foreground">
                      Clique em "Processar Vídeo" para extrair o foreground
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
            Esta ferramenta usa o modelo <strong>arielreplicate/robust_video_matting</strong> do Replicate
            para extrair o foreground (primeiro plano) de vídeos automaticamente.
          </p>
          <p>
            <strong>Custo aproximado:</strong> $0.090 por vídeo (~11 vídeos por $1)
          </p>
          <p>
            <strong>Tempo médio:</strong> ~93 segundos por vídeo (varia com o tamanho)
          </p>
          <p>
            <strong>Hardware:</strong> NVIDIA L40S GPU
          </p>
          <p className="text-xs text-muted-foreground/80 mt-2">
            <strong>Nota:</strong> O modelo processa vídeos com memória temporal usando uma rede neural recorrente,
            ideal para matting de pessoas em vídeos. Pode alcançar até 4K 76FPS em GPUs modernas.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

