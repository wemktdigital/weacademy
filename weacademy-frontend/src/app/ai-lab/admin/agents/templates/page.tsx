'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import type { Agent } from '@/lib/validations/agent.schema'

export default function TemplatesPage() {
  const router = useRouter()
  const [templates, setTemplates] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTemplate, setSelectedTemplate] = useState<Agent | null>(null)
  const [openDialog, setOpenDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [providerFilter, setProviderFilter] = useState<string>('all')

  useEffect(() => {
    fetchTemplates()
  }, [categoryFilter, providerFilter])

  const fetchTemplates = async () => {
    try {
      const params = new URLSearchParams()
      if (categoryFilter !== 'all') params.append('category', categoryFilter)
      if (providerFilter !== 'all') params.append('provider', providerFilter)

      const response = await fetch(`/api/lab-ia/admin/templates?${params}`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      const data = await response.json()
      setTemplates(data.templates || [])
    } catch (error) {
      console.error('Error fetching templates:', error)
      toast.error('Erro ao carregar templates')
    } finally {
      setLoading(false)
    }
  }

  const handleUseTemplate = (template: Agent) => {
    setSelectedTemplate(template)
    setOpenDialog(true)
  }

  const confirmUseTemplate = async () => {
    if (!selectedTemplate) return

    try {
      // Redirecionar para a página de criação de agente com os dados preenchidos
      const params = new URLSearchParams({
        use_template: 'true',
        name: selectedTemplate.name || '',
        description: selectedTemplate.description || '',
        icon: selectedTemplate.icon || '',
        type: selectedTemplate.type || 'llm',
        provider: selectedTemplate.provider || '',
        model: selectedTemplate.model || '',
        prompt: selectedTemplate.prompt || '',
        category: selectedTemplate.category || '',
      })
      
      router.push(`/ai-lab/admin/agents?${params}`)
    } catch (error) {
      console.error('Error using template:', error)
      toast.error('Erro ao usar template')
    }
  }

  const handleExport = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/templates?action=export')
      if (!response.ok) throw new Error('Failed to export templates')
      const data = await response.json()
      
      // Criar arquivo JSON e fazer download
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `templates-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      
      toast.success('Templates exportados com sucesso!')
    } catch (error) {
      console.error('Error exporting templates:', error)
      toast.error('Erro ao exportar templates')
    }
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text)
      
      if (!data.templates || !Array.isArray(data.templates)) {
        toast.error('Formato de arquivo inválido')
        return
      }

      const response = await fetch('/api/lab-ia/admin/templates/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) throw new Error('Failed to import templates')
      
      const result = await response.json()
      toast.success(result.message)
      fetchTemplates()
    } catch (error) {
      console.error('Error importing templates:', error)
      toast.error('Erro ao importar templates')
    }
  }

  const filteredTemplates = templates.filter(template =>
    template.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    template.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando templates...</p>
        </div>
      </div>
    )
  }

  const categories = ['Educacional', 'Marketing Médico', 'Gestão Clínica', 'Pesquisa e IA Aplicada', 'Outros']
  const providers = ['OpenAI', 'Google', 'Other']

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">📚 Biblioteca de Templates</h1>
            <p className="text-muted-foreground mt-1">
              Templates prontos para criar agentes rapidamente
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleExport}>
              📥 Exportar
            </Button>
            <label className="cursor-pointer">
              <Button variant="outline" asChild>
                <span>📤 Importar</span>
              </Button>
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImport}
              />
            </label>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid gap-4 md:grid-cols-4">
          <div className="md:col-span-2">
            <Input
              placeholder="🔍 Buscar templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={providerFilter} onValueChange={setProviderFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Provedor" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos Provedores</SelectItem>
              {providers.map(prov => (
                <SelectItem key={prov} value={prov}>{prov}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Templates Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{template.icon || '📋'}</span>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                    </div>
                    <div className="flex gap-2 mt-2">
                      {template.category && (
                        <Badge variant="outline">{template.category}</Badge>
                      )}
                      {template.type && (
                        <Badge variant="secondary">{template.type}</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {template.description || 'Sem descrição'}
                </p>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    onClick={() => handleUseTemplate(template)}
                  >
                    ✨ Usar como base
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setSelectedTemplate(template)
                      setOpenDialog(true)
                    }}
                  >
                    👁️
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredTemplates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum template encontrado</p>
          </div>
        )}

        {/* Dialog de confirmação */}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Usar Template</DialogTitle>
              <DialogDescription>
                Você será redirecionado para a página de criação de agente com os dados deste template preenchidos.
              </DialogDescription>
            </DialogHeader>
            {selectedTemplate && (
              <div className="space-y-2">
                <p className="font-medium">Nome: {selectedTemplate.name}</p>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate.description}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={confirmUseTemplate}>
                Continuar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
