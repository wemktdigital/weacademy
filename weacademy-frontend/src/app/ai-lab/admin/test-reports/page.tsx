'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { FileText, Download, Calendar, CheckCircle2, XCircle, Clock, BarChart3, Play, Loader2, TestTube } from 'lucide-react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { Progress } from '@/components/ui/progress'
import { AVAILABLE_MODELS } from '@/modules/laboratorio-ia/config/models'

interface TestReport {
  filename: string
  timestamp: string
  summary: {
    total: number
    success: number
    failed: number
    successRate: number
  } | null
  size: number
  created: string
  modified: string
  error?: string
}

interface SingleTestResult {
  provider: string
  model: string
  displayName: string
  status: 'success' | 'error'
  latency?: number
  error?: string
  responsePreview?: string
  timestamp: string
}

export default function TestReportsPage() {
  const [reports, setReports] = useState<TestReport[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningTests, setRunningTests] = useState(false)
  const [testProgress, setTestProgress] = useState<{
    current: number
    total: number
    currentModel?: string
    message?: string
  } | null>(null)
  const [testingModel, setTestingModel] = useState<string | null>(null)
  const [singleTestResults, setSingleTestResults] = useState<Record<string, SingleTestResult>>({})
  const { toast } = useToast()

  // Filtrar apenas modelos de texto para testes individuais
  const textModels = AVAILABLE_MODELS.filter(
    m => m.capabilities?.output?.includes('text')
  )

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/test-reports', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Failed to fetch test reports')
      }

      const data = await response.json()
      setReports(data.reports || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (filename: string, type: 'json' | 'txt' = 'json') => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Garantir que o nome do arquivo tenha a extensão correta
      let downloadFilename = filename
      if (type === 'json' && !filename.endsWith('.json')) {
        downloadFilename = filename.replace(/\.txt$/, '') + '.json'
      } else if (type === 'txt' && !filename.endsWith('.txt')) {
        downloadFilename = filename.replace(/\.json$/, '') + '.txt'
      }

      console.log('[Download] Filename original:', filename)
      console.log('[Download] Download filename:', downloadFilename)
      console.log('[Download] Type:', type)

      // Next.js decodifica automaticamente os parâmetros de rota
      // Usar encodeURIComponent para codificar caracteres especiais na URL
      const encodedFilename = encodeURIComponent(downloadFilename)
      console.log('[Download] Encoded filename:', encodedFilename)
      
      const url = `/api/lab-ia/admin/test-reports/${encodedFilename}`
      console.log('[Download] URL completa:', url)
      
      const response = await fetch(url, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      console.log('[Download] Response status:', response.status)
      console.log('[Download] Response ok:', response.ok)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro ao baixar relatório' }))
        console.error('[Download] Error data:', errorData)
        throw new Error(errorData.error || 'Erro ao baixar relatório')
      }

      // Verificar content-type para determinar como processar
      const contentType = response.headers.get('content-type') || ''
      
      if (type === 'json' || contentType.includes('application/json')) {
        const data = await response.json()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = downloadFilename
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }, 100)
      } else {
        const text = await response.text()
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = downloadFilename
        a.style.display = 'none'
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          window.URL.revokeObjectURL(url)
          document.body.removeChild(a)
        }, 100)
      }

      toast({
        title: 'Download iniciado',
        description: `Baixando ${downloadFilename}...`,
      })
    } catch (err) {
      console.error('Download error:', err)
      toast({
        title: 'Erro ao baixar',
        description: err instanceof Error ? err.message : 'Erro ao baixar relatório',
        variant: 'destructive',
      })
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString)
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const handleTestSingleModel = async (provider: string, model: string) => {
    const modelKey = `${provider}:${model}`
    
    if (testingModel === modelKey) return

    setTestingModel(modelKey)
    setError(null)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/test-reports/test-single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
        body: JSON.stringify({
          provider,
          model,
          testMessage: 'Responda apenas com "OK" se você está funcionando corretamente.',
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao executar teste')
      }

      const result: SingleTestResult = await response.json()
      
      setSingleTestResults(prev => ({
        ...prev,
        [modelKey]: result,
      }))

      toast({
        title: result.status === 'success' ? 'Teste bem-sucedido!' : 'Teste falhou',
        description: result.status === 'success' 
          ? `${result.displayName} respondeu em ${result.latency}ms`
          : result.error,
        variant: result.status === 'success' ? 'default' : 'destructive',
      })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      toast({
        title: 'Erro ao executar teste',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setTestingModel(null)
    }
  }

  const handleRunTests = async () => {
    if (runningTests) return

    setRunningTests(true)
    setError(null)
    setTestProgress({ current: 0, total: 0, message: 'Iniciando...' })

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/test-reports/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao executar testes')
      }

      // Processar stream SSE
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) {
        throw new Error('Stream não disponível')
      }

      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              switch (data.type) {
                case 'start':
                  setTestProgress({
                    current: 0,
                    total: data.total,
                    message: data.message || 'Iniciando testes...',
                  })
                  break

                case 'progress':
                  setTestProgress({
                    current: data.current,
                    total: data.total,
                    currentModel: data.model,
                    message: data.message || `Testando ${data.model}...`,
                  })
                  break

                case 'result':
                  setTestProgress({
                    current: data.current,
                    total: data.total,
                    currentModel: data.result.displayName,
                    message: data.result.status === 'success' 
                      ? `✅ ${data.result.displayName} - OK`
                      : `❌ ${data.result.displayName} - ${data.result.error}`,
                  })
                  break

                case 'done':
                  setTestProgress({
                    current: data.total,
                    total: data.total,
                    message: data.message || 'Testes concluídos!',
                  })
                  
                  toast({
                    title: 'Testes concluídos!',
                    description: data.message || 'Relatórios gerados com sucesso',
                  })

                  // Recarregar lista de relatórios após um pequeno delay
                  setTimeout(() => {
                    fetchReports()
                    setTestProgress(null)
                  }, 1000)
                  break

                case 'error':
                  throw new Error(data.error || 'Erro desconhecido')
              }
            } catch (e) {
              console.error('Erro ao processar evento SSE:', e)
            }
          }
        }
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      setError(errorMessage)
      setTestProgress(null)
      toast({
        title: 'Erro ao executar testes',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setRunningTests(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Erro</h1>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={fetchReports}>Tentar Novamente</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Relatórios de Teste - Modelos LLM</h1>
            <p className="text-muted-foreground mt-1">
              Visualize e baixe relatórios de testes automatizados dos modelos
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/ai-lab/admin">
              <Button variant="outline">Voltar ao Dashboard</Button>
            </Link>
            <Button 
              onClick={handleRunTests} 
              disabled={runningTests}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {runningTests ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Executando Testes...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4 mr-2" />
                  Executar Testes
                </>
              )}
            </Button>
            <Button 
              onClick={fetchReports} 
              variant="outline"
              disabled={runningTests}
            >
              Atualizar
            </Button>
          </div>
        </div>

        {/* Progress Card */}
        {testProgress && (
          <Card className="border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Executando Testes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-muted-foreground">
                    {testProgress.currentModel || testProgress.message}
                  </span>
                  <span className="font-medium">
                    {testProgress.current}/{testProgress.total}
                  </span>
                </div>
                <Progress 
                  value={testProgress.total > 0 ? (testProgress.current / testProgress.total) * 100 : 0} 
                  className="h-2"
                />
              </div>
              {testProgress.message && (
                <p className="text-sm text-muted-foreground">
                  {testProgress.message}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Informações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Clique em <strong>"Executar Testes"</strong> para testar todos os modelos LLM automaticamente e gerar um novo relatório.
            </p>
            <p className="text-sm text-muted-foreground mb-2">
              Ou execute manualmente via terminal:
            </p>
            <code className="text-xs bg-muted px-2 py-1 rounded block mb-4">
              TEST_AUTH_TOKEN="token" npm run test:llm-models
            </code>
            <p className="text-sm text-muted-foreground">
              Cada relatório contém resultados detalhados de todos os modelos testados, incluindo latência, taxa de sucesso e erros.
            </p>
          </CardContent>
        </Card>

        {/* Individual Model Tests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Testes Individuais de Modelos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              Teste modelos individuais para verificar seu status e latência em tempo real.
            </p>
            
            <div className="space-y-4">
              {textModels.map((modelConfig) => {
                const modelKey = `${modelConfig.provider}:${modelConfig.model}`
                const isTesting = testingModel === modelKey
                const testResult = singleTestResults[modelKey]

                return (
                  <div key={modelKey} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{modelConfig.icon}</span>
                        <div>
                          <div className="font-medium">{modelConfig.displayName}</div>
                          <div className="text-sm text-muted-foreground">
                            {modelConfig.provider} • {modelConfig.model}
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestSingleModel(modelConfig.provider, modelConfig.model)}
                        disabled={isTesting || runningTests}
                      >
                        {isTesting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Testando...
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4 mr-2" />
                            Testar
                          </>
                        )}
                      </Button>
                    </div>

                    {testResult && (
                      <div className="mt-3 pt-3 border-t">
                        <div className="flex items-center gap-2 mb-2">
                          {testResult.status === 'success' ? (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                          <span className={`text-sm font-medium ${
                            testResult.status === 'success' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {testResult.status === 'success' ? 'Sucesso' : 'Falha'}
                          </span>
                          {testResult.latency && (
                            <Badge variant="outline" className="text-xs">
                              <Clock className="h-3 w-3 mr-1" />
                              {testResult.latency}ms
                            </Badge>
                          )}
                        </div>
                        {testResult.error && (
                          <p className="text-sm text-red-600 mb-2">{testResult.error}</p>
                        )}
                        {testResult.responsePreview && (
                          <p className="text-sm text-muted-foreground">
                            <strong>Resposta:</strong> {testResult.responsePreview}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-2">
                          Testado em {new Date(testResult.timestamp).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Reports List */}
        {reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Nenhum relatório encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Execute o script de teste para gerar relatórios:
              </p>
              <code className="text-sm bg-muted px-3 py-2 rounded block w-fit mx-auto">
                TEST_AUTH_TOKEN="token" npm run test:llm-models
              </code>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <Card key={report.filename}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5" />
                        {report.filename}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 mt-2">
                        <Badge variant="outline" className="text-xs">
                          <Calendar className="h-3 w-3 mr-1" />
                          {formatDate(report.timestamp)}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {formatFileSize(report.size)}
                        </Badge>
                        {report.summary && (
                          <>
                            <Badge 
                              variant={report.summary.successRate >= 80 ? "default" : "destructive"}
                              className="text-xs"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              {report.summary.successRate}% sucesso
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {report.summary.success}/{report.summary.total} modelos
                            </Badge>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(report.filename, 'json')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        JSON
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(report.filename, 'txt')}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        TXT
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                {report.summary && (
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="text-lg font-semibold">{report.summary.total}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Sucesso</p>
                        <p className="text-lg font-semibold text-green-600">
                          {report.summary.success}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Falhas</p>
                        <p className="text-lg font-semibold text-red-600">
                          {report.summary.failed}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                )}
                {report.error && (
                  <CardContent>
                    <p className="text-sm text-destructive">{report.error}</p>
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

