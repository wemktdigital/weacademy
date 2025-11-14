'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PipelineTemplateCard } from '@/modules/laboratorio-ia/components/PipelineTemplateCard'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { BookOpen, Plus, Search, Filter, Download, Upload } from 'lucide-react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PipelineTemplate {
  id: string
  name: string
  description?: string
  category?: string
  steps: Array<{ order: number; agent_name: string }>
  agent_templates?: Array<{ name: string; template_id?: string }>
  official?: boolean
  created_at?: string
  updated_at?: string
}

export default function PipelineTemplatesPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const router = useRouter()
  const [templates, setTemplates] = useState<PipelineTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const categories = [
    { value: 'marketing', label: 'Marketing' },
    { value: 'educacional', label: 'Educacional' },
    { value: 'pesquisa', label: 'Pesquisa' },
    { value: 'compliance', label: 'Compliance' },
    { value: 'outros', label: 'Outros' },
  ]

  useEffect(() => {
    if (user) {
      loadTemplates()
    }
  }, [user, selectedCategory])

  const loadTemplates = async () => {
    try {
      setLoading(true)

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const params = new URLSearchParams()
      if (selectedCategory) params.append('category', selectedCategory)

      const response = await fetch(`/api/lab-ia/admin/pipelines/templates?${params.toString()}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar templates')
      }

      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error: any) {
      console.error('Erro ao carregar templates:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível carregar os templates',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleUseAsBase = (template: PipelineTemplate) => {
    // Navegar para a página de criação de pipeline com o template pré-preenchido
    const queryParams = new URLSearchParams({
      template: template.id,
      name: template.name,
      description: template.description || '',
      category: template.category || '',
    })
    
    router.push(`/ai-lab/admin/pipelines?${queryParams.toString()}`)
  }

  const handleCopy = async (template: PipelineTemplate) => {
    try {
      const templateJson = JSON.stringify(template, null, 2)
      await navigator.clipboard.writeText(templateJson)
      toast({
        title: 'Copiado!',
        description: 'Template copiado para a área de transferência',
      })
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível copiar o template',
        variant: 'destructive',
      })
    }
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(templates, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `pipeline-templates-${new Date().toISOString()}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    
    toast({
      title: 'Exportado!',
      description: 'Templates exportados com sucesso',
    })
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const importedTemplates = JSON.parse(text)

      if (!Array.isArray(importedTemplates)) {
        throw new Error('Formato inválido: deve ser um array de templates')
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      for (const template of importedTemplates) {
        const response = await fetch('/api/lab-ia/admin/pipelines/templates', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token && { 'Authorization': `Bearer ${token}` })
          },
          body: JSON.stringify(template),
        })

        if (!response.ok) {
          throw new Error(`Erro ao importar template: ${template.name}`)
        }
      }

      toast({
        title: 'Importado!',
        description: `${importedTemplates.length} templates importados com sucesso`,
      })

      await loadTemplates()
    } catch (error: any) {
      console.error('Erro ao importar:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível importar os templates',
        variant: 'destructive',
      })
    }

    // Resetar input
    event.target.value = ''
  }

  // Filtrar templates por busca
  const filteredTemplates = templates.filter((template) => {
    const matchesSearch = !searchQuery || 
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.category?.toLowerCase().includes(searchQuery.toLowerCase())

    return matchesSearch
  })

  if (!user || !isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Você precisa ser administrador para acessar esta página
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <BookOpen className="h-8 w-8" />
            Templates de Pipelines
          </h1>
          <p className="text-muted-foreground mt-1">
            Biblioteca de templates para criação rápida de pipelines
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/ai-lab/admin/pipelines">
            <Button variant="outline">Voltar</Button>
          </Link>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" />
            Exportar
          </Button>
          <label htmlFor="import-templates">
            <Button variant="outline" asChild>
              <span>
                <Upload className="h-4 w-4 mr-2" />
                Importar
              </span>
            </Button>
          </label>
          <input
            id="import-templates"
            type="file"
            accept=".json"
            onChange={handleImport}
            className="hidden"
          />
        </div>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar templates..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select 
              value={selectedCategory || undefined} 
              onValueChange={(value) => setSelectedCategory(value || '')}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Todas as Categorias" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Listagem */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando templates...</p>
        </div>
      ) : filteredTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              {templates.length === 0
                ? 'Nenhum template encontrado. Crie o primeiro template!'
                : 'Nenhum template encontrado com os filtros selecionados.'}
            </p>
            <Link href="/ai-lab/admin/pipelines">
              <Button variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Criar Pipeline
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTemplates.map((template) => (
            <PipelineTemplateCard
              key={template.id}
              template={template}
              onUseAsBase={handleUseAsBase}
              onCopy={handleCopy}
            />
          ))}
        </div>
      )}
    </div>
  )
}

