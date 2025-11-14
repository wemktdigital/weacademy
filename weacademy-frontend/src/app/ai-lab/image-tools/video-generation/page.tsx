'use client'

import { useState, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Slider } from '@/components/ui/slider'
import { Loader2, Video, Upload, Download, X, Wand2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function VideoGenerationPage() {
  const [prompt, setPrompt] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState([5])
  const [motion, setMotion] = useState([0.5])
  const [seed, setSeed] = useState<number | undefined>(undefined)
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
  }

  const handleGenerateVideo = async () => {
    if (!prompt.trim()) {
      toast.error('Por favor, forneça um prompt descrevendo o vídeo')
      return
    }

    setProcessing(true)
    setResultUrl(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Se tiver arquivo, usar preview URL
      let finalImageUrl = imageUrl || (uploadedFile && previewUrl ? previewUrl : undefined)

      toast.info('Gerando vídeo... Isso pode levar alguns minutos.')

      const response = await fetch('/api/lab-ia/video/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          image: finalImageUrl,
          duration: duration[0],
          motion: motion[0],
          seed: seed || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao gerar vídeo')
      }

      const data = await response.json()

      if (data.success && data.output) {
        const output = typeof data.output === 'string' ? data.output : data.output[0]
        setResultUrl(output)
        toast.success(`Vídeo gerado! Tempo: ${(data.processingTime / 1000).toFixed(1)}s`)
      } else {
        throw new Error('Erro ao gerar vídeo')
      }
    } catch (error: any) {
      console.error('Erro ao gerar vídeo:', error)
      toast.error(error.message || 'Erro ao gerar vídeo')
    } finally {
      setProcessing(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return

    const link = document.createElement('a')
    link.href = resultUrl
    link.download = 'video-gerado.mp4'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleClear = () => {
    setPrompt('')
    setImageUrl('')
    setUploadedFile(null)
    setPreviewUrl(null)
    setDuration([5])
    setMotion([0.5])
    setSeed(undefined)
    setResultUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const generateRandomSeed = () => {
    setSeed(Math.floor(Math.random() * 1000000))
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Geração de Vídeo com IA</h1>
        <p className="text-muted-foreground mt-1">
          Crie vídeos cinematográficos usando Seedance 1.0 Pro Fast (Powered by Replicate)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="prompt">Prompt *</Label>
            <Textarea
              id="prompt"
              placeholder="Descreva o vídeo que deseja gerar. Ex: 'Uma pessoa caminhando pela rua ao pôr do sol'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              disabled={processing}
              rows={4}
            />
            <p className="text-xs text-muted-foreground">
              Seja específico sobre o que deseja ver no vídeo para melhores resultados
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duração: {duration[0]}s</Label>
              <Slider
                id="duration"
                min={1}
                max={10}
                step={1}
                value={duration}
                onValueChange={setDuration}
                disabled={processing}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="motion">Intensidade do Movimento: {Math.round(motion[0] * 100)}%</Label>
              <Slider
                id="motion"
                min={0}
                max={1}
                step={0.1}
                value={motion}
                onValueChange={setMotion}
                disabled={processing}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="seed">Seed (opcional)</Label>
            <div className="flex gap-2">
              <Input
                id="seed"
                type="number"
                placeholder="Deixe em branco para gerar aleatório"
                value={seed || ''}
                onChange={(e) => setSeed(e.target.value ? parseInt(e.target.value) : undefined)}
                disabled={processing}
              />
              <Button
                variant="outline"
                onClick={generateRandomSeed}
                disabled={processing}
              >
                Aleatório
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Use o mesmo seed para reproduzir resultados similares
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">Imagem Inicial (Opcional)</span>
            </div>
          </div>

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
                  onClick={() => setImageUrl('')}
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
                Arquivo selecionado: {uploadedFile.name}
              </p>
            )}
          </div>

          {(previewUrl || imageUrl) && (
            <div className="relative w-full max-w-md aspect-video bg-muted rounded-lg overflow-hidden">
              <img
                src={previewUrl || imageUrl}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleGenerateVideo}
              disabled={processing || !prompt.trim()}
              className="flex-1"
            >
              {processing ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando vídeo... (pode levar alguns minutos)
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4 mr-2" />
                  Gerar Vídeo
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClear}
              disabled={processing}
            >
              Limpar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultado */}
      {resultUrl && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Vídeo Gerado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
          </CardContent>
        </Card>
      )}

      {/* Informações */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sobre</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Esta ferramenta usa o modelo <strong>Seedance 1.0 Pro Fast</strong> do ByteDance
            para gerar vídeos cinematográficos usando IA.
          </p>
          <p>
            <strong>Características:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>30-60% mais rápido que Seedance 1.0 Pro</li>
            <li>~60% de redução de custo comparado ao Pro</li>
            <li>Alta qualidade visual cinematográfica</li>
            <li>Controle de movimento consistente</li>
          </ul>
          <p>
            <strong>Custo aproximado:</strong> $0.10-0.20 por vídeo (varia com duração e complexidade)
          </p>
          <p>
            <strong>Uso ideal:</strong> Prototipagem rápida, storyboarding, ferramentas criativas e geração de mídia em escala
          </p>
          <p className="text-xs text-muted-foreground/80 mt-2">
            <strong>Nota:</strong> Otimizado para vídeos cinematográficos 2D. Não é otimizado para 3D ou realismo físico.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
