'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { Loader2, Upload, Image as ImageIcon, Mic, Video, FileText, CheckCircle2, AlertCircle } from 'lucide-react'
import Image from 'next/image'

interface AnalysisResult {
  findings: string[]
  diagnosis: string
  recommendations: string[]
  confidence: number
  annotatedRegions?: Array<{
    region: string
    description: string
    concern: 'low' | 'medium' | 'high'
  }>
  similarCases?: Array<{
    caseId: string
    similarity: number
    description: string
  }>
}

export default function MedicalAnalysisPage() {
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<'image' | 'audio' | 'video'>('image')
  
  // Estados para análise de imagem
  const [imageUrl, setImageUrl] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imageType, setImageType] = useState<'xray' | 'mri' | 'ct' | 'ultrasound' | 'dermatology' | 'general'>('general')
  const [clinicalContext, setClinicalContext] = useState('')
  const [imageAnalysis, setImageAnalysis] = useState<AnalysisResult | null>(null)
  const [analyzingImage, setAnalyzingImage] = useState(false)
  
  // Estados para análise de áudio
  const [audioUrl, setAudioUrl] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [transcription, setTranscription] = useState('')
  const [audioAnalysis, setAudioAnalysis] = useState<any>(null)
  const [analyzingAudio, setAnalyzingAudio] = useState(false)
  
  // Estados para análise de vídeo
  const [videoUrl, setVideoUrl] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [procedureType, setProcedureType] = useState('')
  const [videoAnalysis, setVideoAnalysis] = useState<any>(null)
  const [analyzingVideo, setAnalyzingVideo] = useState(false)

  const handleImageUpload = async (file: File) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      // Tentar criar bucket se não existir (usando service role)
      try {
        const { data: buckets } = await supabase.storage.listBuckets()
        const bucketExists = buckets?.some(b => b.id === 'lab-medical-images')
        
        if (!bucketExists) {
          // Bucket será criado pela migration, mas podemos tentar criar via API
          console.warn('[Medical Analysis] Bucket lab-medical-images não encontrado. Execute a migration SQL.')
        }
      } catch (error) {
        console.warn('[Medical Analysis] Erro ao verificar buckets:', error)
      }

      // Upload para Supabase Storage
      const fileExt = file.name.split('.').pop()
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
      const filePath = `medical-images/${fileName}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('lab-medical-images')
        .upload(filePath, file)

      if (uploadError) {
        // Se erro de bucket não encontrado, informar usuário
        if (uploadError.message.includes('Bucket not found')) {
          throw new Error('Bucket de imagens médicas não configurado. Execute a migration SQL primeiro.')
        }
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('lab-medical-images')
        .getPublicUrl(filePath)

      return publicUrl
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error)
      throw error
    }
  }

  const handleAnalyzeImage = async () => {
    if (!imageUrl && !imageFile) {
      toast({
        title: 'Erro',
        description: 'Selecione uma imagem ou forneça uma URL',
        variant: 'destructive',
      })
      return
    }

    try {
      setAnalyzingImage(true)

      let finalImageUrl = imageUrl

      if (imageFile) {
        toast({
          title: 'Upload em progresso',
          description: 'Fazendo upload da imagem...',
        })
        finalImageUrl = await handleImageUpload(imageFile)
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/medical/analyze-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          imageUrl: finalImageUrl,
          imageType,
          clinicalContext: clinicalContext || undefined,
          options: {
            includeSimilarCases: true,
            generateAnnotations: true,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao analisar imagem')
      }

      const data = await response.json()
      setImageAnalysis(data.analysis)

      toast({
        title: 'Análise concluída',
        description: `Confiança: ${(data.analysis.confidence * 100).toFixed(1)}%`,
      })
    } catch (error: any) {
      console.error('Erro ao analisar imagem:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao analisar imagem médica',
        variant: 'destructive',
      })
    } finally {
      setAnalyzingImage(false)
    }
  }

  const handleAnalyzeAudio = async () => {
    if (!audioUrl && !audioFile && !transcription) {
      toast({
        title: 'Erro',
        description: 'Forneça um arquivo de áudio, URL ou transcrição',
        variant: 'destructive',
      })
      return
    }

    try {
      setAnalyzingAudio(true)

      let finalAudioUrl = audioUrl

      if (audioFile) {
        // Upload de áudio similar ao de imagem
        // TODO: Implementar upload de áudio
        toast({
          title: 'Upload de áudio',
          description: 'Funcionalidade de upload em desenvolvimento',
        })
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/medical/analyze-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioUrl: finalAudioUrl || undefined,
          transcription: transcription || undefined,
          options: {
            detectEvents: true,
            generateSummary: true,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao analisar áudio')
      }

      const data = await response.json()
      setAudioAnalysis(data.analysis)

      toast({
        title: 'Análise concluída',
        description: 'Áudio analisado com sucesso',
      })
    } catch (error: any) {
      console.error('Erro ao analisar áudio:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao analisar áudio médico',
        variant: 'destructive',
      })
    } finally {
      setAnalyzingAudio(false)
    }
  }

  const handleAnalyzeVideo = async () => {
    if (!videoUrl && !videoFile) {
      toast({
        title: 'Erro',
        description: 'Selecione um vídeo ou forneça uma URL',
        variant: 'destructive',
      })
      return
    }

    try {
      setAnalyzingVideo(true)

      let finalVideoUrl = videoUrl

      if (videoFile) {
        // Upload de vídeo similar ao de imagem
        // TODO: Implementar upload de vídeo
        toast({
          title: 'Upload de vídeo',
          description: 'Funcionalidade de upload em desenvolvimento',
        })
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/medical/analyze-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          videoUrl: finalVideoUrl,
          procedureType: procedureType || undefined,
          options: {
            segmentByTopics: true,
            extractKeyMoments: true,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Erro ao analisar vídeo')
      }

      const data = await response.json()
      setVideoAnalysis(data.analysis)

      toast({
        title: 'Análise concluída',
        description: 'Vídeo analisado com sucesso',
      })
    } catch (error: any) {
      console.error('Erro ao analisar vídeo:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Erro ao analisar vídeo médico',
        variant: 'destructive',
      })
    } finally {
      setAnalyzingVideo(false)
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold">Análise Médica Multi-Modal</h1>
        <p className="text-muted-foreground mt-1">
          Análise inteligente de imagens médicas, áudio de consultas e vídeos de procedimentos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="image">
            <ImageIcon className="h-4 w-4 mr-2" />
            Análise de Imagens
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Mic className="h-4 w-4 mr-2" />
            Análise de Áudio
          </TabsTrigger>
          <TabsTrigger value="video">
            <Video className="h-4 w-4 mr-2" />
            Análise de Vídeo
          </TabsTrigger>
        </TabsList>

        {/* Tab de Análise de Imagens */}
        <TabsContent value="image" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Imagem Médica</CardTitle>
              <CardDescription>
                Analise imagens médicas (raio-X, ressonância, tomografia, ultrassom, dermatologia)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="image-url">URL da Imagem</Label>
                  <Input
                    id="image-url"
                    placeholder="https://..."
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="image-file">Ou selecione um arquivo</Label>
                  <Input
                    id="image-file"
                    type="file"
                    accept="image/*"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="image-type">Tipo de Imagem</Label>
                <Select value={imageType} onValueChange={(v: any) => setImageType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="xray">Raio-X</SelectItem>
                    <SelectItem value="mri">Ressonância Magnética (MRI)</SelectItem>
                    <SelectItem value="ct">Tomografia Computadorizada (CT)</SelectItem>
                    <SelectItem value="ultrasound">Ultrassom</SelectItem>
                    <SelectItem value="dermatology">Dermatologia</SelectItem>
                    <SelectItem value="general">Geral</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="clinical-context">Contexto Clínico (Opcional)</Label>
                <Textarea
                  id="clinical-context"
                  placeholder="Informações relevantes sobre o paciente e sintomas..."
                  value={clinicalContext}
                  onChange={(e) => setClinicalContext(e.target.value)}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleAnalyzeImage}
                disabled={analyzingImage || (!imageUrl && !imageFile)}
                className="w-full"
              >
                {analyzingImage ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Analisar Imagem
                  </>
                )}
              </Button>

              {imageAnalysis && (
                <Card className="mt-4">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>Resultado da Análise</CardTitle>
                      <Badge variant={imageAnalysis.confidence > 0.7 ? 'default' : 'secondary'}>
                        Confiança: {(imageAnalysis.confidence * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Achados Principais</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {imageAnalysis.findings.map((finding, i) => (
                          <li key={i}>{finding}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Diagnóstico</h4>
                      <p>{imageAnalysis.diagnosis}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Recomendações</h4>
                      <ul className="list-disc list-inside space-y-1">
                        {imageAnalysis.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>

                    {imageAnalysis.annotatedRegions && imageAnalysis.annotatedRegions.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Regiões Anotadas</h4>
                        <div className="space-y-2">
                          {imageAnalysis.annotatedRegions.map((region, i) => (
                            <div key={i} className="flex items-start gap-2">
                              <Badge variant={
                                region.concern === 'high' ? 'destructive' :
                                region.concern === 'medium' ? 'default' : 'secondary'
                              }>
                                {region.region}
                              </Badge>
                              <span>{region.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Análise de Áudio */}
        <TabsContent value="audio" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Áudio de Consulta</CardTitle>
              <CardDescription>
                Analise áudio de consultas médicas para extrair insights e eventos importantes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="audio-url">URL do Áudio</Label>
                  <Input
                    id="audio-url"
                    placeholder="https://..."
                    value={audioUrl}
                    onChange={(e) => setAudioUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="audio-file">Ou selecione um arquivo</Label>
                  <Input
                    id="audio-file"
                    type="file"
                    accept="audio/*"
                    onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="transcription">Ou cole a transcrição</Label>
                <Textarea
                  id="transcription"
                  placeholder="Transcrição da consulta médica..."
                  value={transcription}
                  onChange={(e) => setTranscription(e.target.value)}
                  rows={5}
                />
              </div>

              <Button
                onClick={handleAnalyzeAudio}
                disabled={analyzingAudio || (!audioUrl && !audioFile && !transcription)}
                className="w-full"
              >
                {analyzingAudio ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Mic className="h-4 w-4 mr-2" />
                    Analisar Áudio
                  </>
                )}
              </Button>

              {audioAnalysis && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Resultado da Análise</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Resumo</h4>
                      <p>{audioAnalysis.summary}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Sentimento</h4>
                      <Badge variant={
                        audioAnalysis.sentiment === 'urgent' ? 'destructive' :
                        audioAnalysis.sentiment === 'negative' ? 'default' :
                        audioAnalysis.sentiment === 'positive' ? 'default' : 'secondary'
                      }>
                        {audioAnalysis.sentiment === 'urgent' ? 'Urgente' :
                         audioAnalysis.sentiment === 'negative' ? 'Negativo' :
                         audioAnalysis.sentiment === 'positive' ? 'Positivo' : 'Neutro'}
                      </Badge>
                    </div>

                    {audioAnalysis.keyPoints && audioAnalysis.keyPoints.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Pontos-Chave</h4>
                        <ul className="list-disc list-inside space-y-1">
                          {audioAnalysis.keyPoints.map((point: string, i: number) => (
                            <li key={i}>{point}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {audioAnalysis.detectedEvents && audioAnalysis.detectedEvents.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Eventos Detectados</h4>
                        <div className="space-y-2">
                          {audioAnalysis.detectedEvents.map((event: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <Badge>{event.type}</Badge>
                              <span>{event.description}</span>
                              {event.timestamp && (
                                <span className="text-muted-foreground text-sm">
                                  ({event.timestamp}s)
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab de Análise de Vídeo */}
        <TabsContent value="video" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Análise de Vídeo de Procedimento</CardTitle>
              <CardDescription>
                Analise vídeos de procedimentos médicos para extrair segmentos e momentos-chave
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="video-url">URL do Vídeo</Label>
                  <Input
                    id="video-url"
                    placeholder="https://..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="video-file">Ou selecione um arquivo</Label>
                  <Input
                    id="video-file"
                    type="file"
                    accept="video/*"
                    onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="procedure-type">Tipo de Procedimento (Opcional)</Label>
                <Input
                  id="procedure-type"
                  placeholder="Ex: Cirurgia cardíaca, Endoscopia..."
                  value={procedureType}
                  onChange={(e) => setProcedureType(e.target.value)}
                />
              </div>

              <Button
                onClick={handleAnalyzeVideo}
                disabled={analyzingVideo || (!videoUrl && !videoFile)}
                className="w-full"
              >
                {analyzingVideo ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analisando...
                  </>
                ) : (
                  <>
                    <Video className="h-4 w-4 mr-2" />
                    Analisar Vídeo
                  </>
                )}
              </Button>

              {videoAnalysis && (
                <Card className="mt-4">
                  <CardHeader>
                    <CardTitle>Resultado da Análise</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold mb-2">Tipo de Procedimento</h4>
                      <p>{videoAnalysis.procedureType}</p>
                    </div>

                    <div>
                      <h4 className="font-semibold mb-2">Resumo</h4>
                      <p>{videoAnalysis.summary}</p>
                    </div>

                    {videoAnalysis.segments && videoAnalysis.segments.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Segmentos</h4>
                        <div className="space-y-2">
                          {videoAnalysis.segments.map((segment: any, i: number) => (
                            <div key={i} className="border rounded p-2">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{segment.topic}</span>
                                <span className="text-sm text-muted-foreground">
                                  {Math.floor(segment.timestamp / 60)}:{(segment.timestamp % 60).toString().padStart(2, '0')}
                                </span>
                              </div>
                              <p className="text-sm text-muted-foreground">{segment.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {videoAnalysis.keyMoments && videoAnalysis.keyMoments.length > 0 && (
                      <div>
                        <h4 className="font-semibold mb-2">Momentos-Chave</h4>
                        <div className="space-y-2">
                          {videoAnalysis.keyMoments.map((moment: any, i: number) => (
                            <div key={i} className="flex items-start gap-2">
                              <Badge variant={
                                moment.importance === 'high' ? 'destructive' :
                                moment.importance === 'medium' ? 'default' : 'secondary'
                              }>
                                {Math.floor(moment.timestamp / 60)}:{(moment.timestamp % 60).toString().padStart(2, '0')}
                              </Badge>
                              <span>{moment.description}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

