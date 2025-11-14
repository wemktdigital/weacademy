'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
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
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import type { Agent } from '@/lib/validations/agent.schema'
import { PROVIDERS, getModelsByProvider } from '@/modules/laboratorio-ia/config/models'
import { PROMPT_TEMPLATES, getDefaultTemplate } from '@/modules/laboratorio-ia/config/promptTemplates'
import { Upload, FileText, X, File, Loader2, Info, LayoutGrid, List } from 'lucide-react'

export default function AgentsAdminPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [checkingRole, setCheckingRole] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deleteAgentId, setDeleteAgentId] = useState<string | null>(null)
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null)
  const [formData, setFormData] = useState<Partial<Agent>>({
    name: '',
    description: '',
    icon: '',
    type: 'llm',
    provider: '',
    model: '',
    prompt: '',
    category: '',
    active: true,
    usage_instructions: '',
    expected_result: '',
  })
  const [selectedProvider, setSelectedProvider] = useState<string>('')
  const [availableModels, setAvailableModels] = useState<Array<{ provider: string; model: string; displayName: string; icon: string }>>([])
  const [knowledgeFiles, setKnowledgeFiles] = useState<Array<{ name: string; url: string }>>([])
  const [uploadingFile, setUploadingFile] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadingFileName, setUploadingFileName] = useState<string>('')
  const [selectedTemplate, setSelectedTemplate] = useState<string>('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'cards' | 'list'>('cards')

  useEffect(() => {
    checkUserRole()
  }, [user])

  useEffect(() => {
    if (!checkingRole && user) {
      fetchAgents()
      
      // Verificar se há parâmetros de template na URL
      const useTemplate = searchParams.get('use_template')
      if (useTemplate === 'true') {
        setFormData({
          name: searchParams.get('name') || '',
          description: searchParams.get('description') || '',
          icon: searchParams.get('icon') || '',
          type: (searchParams.get('type') as 'llm' | 'automation') || 'llm',
          provider: searchParams.get('provider') || '',
          model: searchParams.get('model') || '',
          prompt: searchParams.get('prompt') || '',
          category: searchParams.get('category') || '',
          active: true,
        })
        setOpenDialog(true)
        // Limpar URL
        router.replace('/ai-lab/admin/agents')
      }
    }
  }, [checkingRole, user])

  const checkUserRole = async () => {
    if (!user) {
      router.push('/auth/login')
      return
    }

    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (error) throw error

      if (!profile || !['admin', 'gestor_we'].includes(profile.role)) {
        toast.error('Acesso negado. Apenas administradores podem acessar esta página.')
        router.push('/ai-lab')
        return
      }

      setCheckingRole(false)
    } catch (error) {
      console.error('Error checking user role:', error)
      toast.error('Erro ao verificar permissões')
      router.push('/ai-lab')
    }
  }

  const fetchAgents = async () => {
    try {
      // Obter token de autenticação
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/agents?limit=1000', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Failed to fetch agents')
      }

      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error: any) {
      console.error('Error fetching agents:', error)
      toast.error(error.message || 'Erro ao carregar agentes')
    } finally {
      setLoading(false)
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>()
    agents.forEach((agent) => {
      const category = agent.category?.trim()
      if (category && category.length > 0) {
        set.add(category)
      }
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [agents])

  const filteredAgents = useMemo(() => {
    if (selectedCategory === 'all') return agents
    if (selectedCategory === 'uncategorized') {
      return agents.filter((agent) => !agent.category || agent.category.trim().length === 0)
    }
    return agents.filter((agent) => agent.category === selectedCategory)
  }, [agents, selectedCategory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingAgent
        ? `/api/lab-ia/admin/agents/${editingAgent.id}`
        : '/api/lab-ia/admin/agents'
      
      const method = editingAgent ? 'PUT' : 'POST'
      
      // Obter token de autenticação
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      // Incluir arquivos de conhecimento se houver
      const payload = {
        ...formData,
        knowledge_base_files: knowledgeFiles.map((f) => ({ name: f.name, url: f.url })),
      }

      const response = await fetch(url, {
        method,
        headers: { 
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Failed to save agent')
      }

      toast.success(
        editingAgent ? 'Agente atualizado com sucesso!' : 'Agente criado com sucesso!'
      )
      
      setOpenDialog(false)
      resetForm()
      fetchAgents()
    } catch (error: any) {
      console.error('Error saving agent:', error)
      toast.error(error.message || 'Erro ao salvar agente')
    }
  }

  const handleDelete = async () => {
    if (!deleteAgentId) return

    try {
      // Obter token de autenticação
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/agents/${deleteAgentId}`, {
        method: 'DELETE',
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to delete agent')

      toast.success('Agente excluído com sucesso!')
      setDeleteAgentId(null)
      fetchAgents()
    } catch (error) {
      console.error('Error deleting agent:', error)
      toast.error('Erro ao excluir agente')
    }
  }

  const handleDuplicate = (agent: Agent) => {
    setFormData({
      ...agent,
      name: `${agent.name} (Cópia)`,
    })
    setEditingAgent(null)
    setOpenDialog(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      icon: '',
      type: 'llm',
      provider: '',
      model: '',
      prompt: getDefaultTemplate(),
      category: '',
      active: true,
      usage_instructions: '',
      expected_result: '',
    })
    setSelectedProvider('')
    setAvailableModels([])
    setKnowledgeFiles([])
    setSelectedTemplate('')
    setEditingAgent(null)
  }

  // Quando provider muda, atualizar modelos disponíveis e limpar modelo selecionado
  useEffect(() => {
    if (selectedProvider) {
      const models = getModelsByProvider(selectedProvider)
      setAvailableModels(models)
      // Se não há modelos compatíveis com o provider selecionado, limpar modelo
      if (models.length === 0) {
        setFormData((prev) => ({ ...prev, model: '' }))
      } else {
        // Verificar se o modelo atual é do provider selecionado
        const currentModel = formData.model
        if (currentModel && !models.some((m) => m.model === currentModel)) {
          // Se modelo atual não é do provider selecionado, limpar
          setFormData((prev) => ({ ...prev, model: '' }))
        }
      }
      setFormData((prev) => ({ ...prev, provider: selectedProvider }))
    } else {
      setAvailableModels([])
      setFormData((prev) => ({ ...prev, provider: '', model: '' }))
    }
  }, [selectedProvider, formData.model])

  // Quando carregar agente para edição, atualizar seletores
  useEffect(() => {
    if (editingAgent) {
      if (editingAgent.provider) {
        setSelectedProvider(editingAgent.provider)
        const models = getModelsByProvider(editingAgent.provider)
        setAvailableModels(models)
      }
    } else {
      // Ao criar novo agente, pré-preencher com template padrão se prompt estiver vazio
      if (!formData.prompt) {
        setFormData((prev) => ({ ...prev, prompt: getDefaultTemplate() }))
      }
    }
  }, [editingAgent])

  // Handler para template
  const handleTemplateSelect = (templateName: string) => {
    const template = PROMPT_TEMPLATES.find((t) => t.name === templateName)
    if (template) {
      setFormData((prev) => ({ ...prev, prompt: template.prompt }))
      setSelectedTemplate(templateName)
    }
  }

  // Handler para upload de arquivo com barra de progresso
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validar tipo de arquivo (permitir PDF, TXT, DOCX, MD)
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
    ]
    const allowedExtensions = ['.pdf', '.txt', '.docx', '.md']

    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      toast.error('Tipo de arquivo não suportado. Use PDF, TXT, DOCX ou MD.')
      return
    }

    // Validar tamanho (max 100MB para knowledge base)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      toast.error(`Arquivo muito grande. O arquivo tem ${(file.size / (1024 * 1024)).toFixed(2)}MB, mas o limite máximo é 100MB.`)
      return
    }

    // Atualizar estado imediatamente para mostrar barra de progresso
    setUploadingFileName(file.name)
    setUploadingFile(true)
    setUploadProgress(0)

    // Forçar re-render imediato
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      // Obter token de autenticação
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      // Criar FormData para upload
      const formDataObj = new FormData()
      formDataObj.append('file', file)

      // Usar XMLHttpRequest para ter progresso
      const xhr = new XMLHttpRequest()

      // Definir progresso inicial
      setUploadProgress(5)

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded * 100) / event.total)
          // Garantir que sempre mostre pelo menos algum progresso
          setUploadProgress(Math.max(5, percentComplete))
        } else {
          // Se não conseguir calcular, mostrar progresso incremental
          setUploadProgress((prev) => Math.min(prev + 10, 90))
        }
      })

      // Adicionar listener para quando começar a enviar
      xhr.upload.addEventListener('loadstart', () => {
        setUploadProgress(10)
      })

      const uploadPromise = new Promise<{ url: string; path: string }>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const result = JSON.parse(xhr.responseText)
              resolve(result)
            } catch (e) {
              reject(new Error('Resposta inválida do servidor'))
            }
          } else {
            try {
              const error = JSON.parse(xhr.responseText)
              reject(new Error(error.error || 'Erro ao fazer upload'))
            } catch (e) {
              reject(new Error(`Erro ${xhr.status}: ${xhr.statusText}`))
            }
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Erro de rede ao fazer upload'))
        })

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload cancelado'))
        })

        xhr.open('POST', '/api/upload/knowledge-base')
        xhr.setRequestHeader('Authorization', `Bearer ${token}`)
        xhr.send(formDataObj)
      })

      const result = await uploadPromise

      // Marcar como completo antes de adicionar à lista
      setUploadProgress(100)
      
      // Pequeno delay para mostrar 100%
      await new Promise(resolve => setTimeout(resolve, 300))

      // Adicionar arquivo à lista
      setKnowledgeFiles((prev) => [
        ...prev,
        {
          name: file.name,
          url: result.url,
        },
      ])

      toast.success('Arquivo enviado com sucesso!')
      setUploadProgress(0)
      setUploadingFileName('')
    } catch (error: any) {
      console.error('Erro no upload:', error)
      toast.error(error.message || 'Erro ao fazer upload do arquivo')
      setUploadProgress(0)
      setUploadingFileName('')
    } finally {
      setUploadingFile(false)
      // Limpar input
      e.target.value = ''
    }
  }

  const handleRemoveFile = (index: number) => {
    setKnowledgeFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData(agent)
    // Carregar arquivos de conhecimento se existirem
    console.log('[DEBUG] Editando agente:', agent)
    console.log('[DEBUG] knowledge_base_files:', agent.knowledge_base_files)
    
    if (agent.knowledge_base_files && Array.isArray(agent.knowledge_base_files) && agent.knowledge_base_files.length > 0) {
      setKnowledgeFiles(agent.knowledge_base_files as Array<{ name: string; url: string }>)
      console.log('[DEBUG] Arquivos carregados:', agent.knowledge_base_files)
    } else {
      setKnowledgeFiles([])
      console.log('[DEBUG] Nenhum arquivo encontrado')
    }
    setOpenDialog(true)
  }

  if (checkingRole || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">
            {checkingRole ? 'Verificando permissões...' : 'Carregando agentes...'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8 dark:bg-slate-950 dark:text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground dark:text-white">Gerenciar Agentes</h1>
            <p className="text-muted-foreground mt-1 dark:text-slate-300">
              {agents.length} {agents.length === 1 ? 'agente' : 'agentes'} {agents.length === 1 ? 'disponível' : 'disponíveis'} • Crie e gerencie agentes de IA para o Laboratório
            </p>
          </div>
        </div>

        {/* Info Card - Como usar agentes */}
        <Card className="bg-primary/5 border-primary/20 dark:bg-sky-900/30 dark:border-sky-500/30">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-primary dark:text-sky-300 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1 dark:text-white">Como usar agentes criados</h3>
                <p className="text-xs text-muted-foreground dark:text-slate-200/80">
                  Após criar um agente, vá para o <strong>Laboratório de IA</strong> e clique no botão <strong>"Agentes"</strong> no topo da tela. 
                  Selecione o agente desejado e comece a conversar. O agente aplicará automaticamente suas instruções e base de conhecimento nas respostas.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-muted-foreground dark:text-slate-300">
            Exibindo {filteredAgents.length} de {agents.length} agente{agents.length === 1 ? '' : 's'}
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="category-filter" className="text-sm font-medium">
              Categoria
            </Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger id="category-filter" className="w-56">
                <SelectValue placeholder="Filtrar categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as categorias</SelectItem>
                <SelectItem value="uncategorized">Sem categoria</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 border rounded-lg p-1">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8"
            >
              <LayoutGrid className="h-4 w-4 mr-2" />
              Cards
            </Button>
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              className="h-8"
            >
              <List className="h-4 w-4 mr-2" />
              Lista
            </Button>
          </div>
          <Button onClick={() => {
            resetForm()
            // Garantir que o prompt padrão seja pré-preenchido
            setFormData((prev) => ({
              ...prev,
              prompt: prev.prompt || getDefaultTemplate(),
            }))
            setOpenDialog(true)
          }}>
            + Novo Agente
          </Button>
        </div>

        {/* Agents List */}
        {filteredAgents.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center text-sm text-muted-foreground dark:bg-slate-900/60 dark:border-slate-700/60 dark:text-slate-300">
            Nenhum agente encontrado para esta categoria.
          </div>
        ) : viewMode === 'cards' ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAgents.map((agent) => (
              <Card
                key={agent.id}
                className="dark:bg-slate-900/80 dark:border-slate-700/60 dark:text-slate-100 transition hover:shadow-lg hover:shadow-primary/5 dark:hover:shadow-sky-500/10"
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{agent.icon || '🤖'}</span>
                        <CardTitle className="text-lg text-foreground dark:text-white">{agent.name}</CardTitle>
                      </div>
                      <Badge
                        className="mt-2"
                        variant={agent.active ? 'default' : 'secondary'}
                      >
                        {agent.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 dark:text-slate-300">
                    {agent.description || 'Sem descrição'}
                  </p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground dark:text-slate-400">Tipo:</span>
                      <Badge variant="outline">{agent.type}</Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground dark:text-slate-400">Provedor:</span>
                      <span className="dark:text-slate-200">{agent.provider || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground dark:text-slate-400">Categoria:</span>
                      <span className="dark:text-slate-200">{agent.category || 'N/A'}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(agent)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDuplicate(agent)}
                    >
                      Duplicar
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteAgentId(agent.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredAgents.map((agent) => (
              <Card
                key={agent.id}
                className="dark:bg-slate-900/80 dark:border-slate-700/60 dark:text-slate-100 transition hover:shadow-md hover:shadow-primary/5 dark:hover:shadow-sky-500/10"
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <span className="text-3xl flex-shrink-0">{agent.icon || '🤖'}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-foreground dark:text-white truncate">
                            {agent.name}
                          </h3>
                          <Badge
                            variant={agent.active ? 'default' : 'secondary'}
                            className="flex-shrink-0"
                          >
                            {agent.active ? 'Ativo' : 'Inativo'}
                          </Badge>
                          <Badge variant="outline" className="flex-shrink-0">
                            {agent.type}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mb-3 dark:text-slate-300 line-clamp-2">
                          {agent.description || 'Sem descrição'}
                        </p>
                        <div className="flex flex-wrap gap-4 text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground dark:text-slate-400">Provedor:</span>
                            <span className="font-medium dark:text-slate-200">{agent.provider || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground dark:text-slate-400">Modelo:</span>
                            <span className="font-medium dark:text-slate-200">{agent.model || 'N/A'}</span>
                          </div>
                          {agent.category && (
                            <div className="flex items-center gap-2">
                              <span className="text-muted-foreground dark:text-slate-400">Categoria:</span>
                              <span className="font-medium dark:text-slate-200">{agent.category}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(agent)}
                      >
                        Editar
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDuplicate(agent)}
                      >
                        Duplicar
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteAgentId(agent.id)}
                      >
                        Excluir
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Create/Edit Dialog */}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingAgent ? 'Editar Agente' : 'Criar Novo Agente'}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Resumir Artigo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icon">Ícone</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🤖"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição *</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva a função do agente"
                  required
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="type">Tipo *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) => setFormData({ ...formData, type: value as 'llm' | 'automation' })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="llm">LLM (Local)</SelectItem>
                      <SelectItem value="automation">Automation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    placeholder="Ex: Pesquisa"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="provider">Provedor *</Label>
                  <Select
                    value={selectedProvider}
                    onValueChange={setSelectedProvider}
                    required
                  >
                    <SelectTrigger id="provider">
                      <SelectValue placeholder="Selecione o provedor" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROVIDERS.map((provider) => (
                        <SelectItem key={provider.value} value={provider.value}>
                          {provider.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Selecione o provedor de IA integrado ao laboratório
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo *</Label>
                  <Select
                    value={formData.model}
                    onValueChange={(value) => {
                      const selectedModel = availableModels.find((m) => m.model === value)
                      setFormData({
                        ...formData,
                        model: value,
                        provider: selectedModel?.provider || selectedProvider,
                      })
                    }}
                    disabled={!selectedProvider || availableModels.length === 0}
                    required
                  >
                    <SelectTrigger id="model">
                      <SelectValue placeholder={selectedProvider ? 'Selecione o modelo' : 'Selecione o provedor primeiro'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableModels.map((model) => (
                        <SelectItem key={model.model} value={model.model}>
                          <div className="flex items-center gap-2">
                            <span>{model.icon}</span>
                            <span>{model.displayName}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {selectedProvider
                      ? `Modelos disponíveis do ${selectedProvider}`
                      : 'Selecione um provedor para ver os modelos disponíveis'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="prompt">Prompt Base *</Label>
                  <Select value={selectedTemplate || undefined} onValueChange={handleTemplateSelect}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Usar template..." />
                    </SelectTrigger>
                    <SelectContent>
                      {PROMPT_TEMPLATES.map((template) => (
                        <SelectItem key={template.name} value={template.name}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) => {
                    setFormData({ ...formData, prompt: e.target.value })
                    setSelectedTemplate('') // Limpar template selecionado se usuário editar manualmente
                  }}
                  placeholder="Instruções para o agente... Use {{placeholder}} para espaços a preencher."
                  rows={10}
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Dica: Use templates pré-configurados para facilitar a criação. Você pode editar o template escolhido ou criar do zero.
                  Use <code className="bg-muted px-1 rounded">&#123;&#123;placeholder&#125;&#125;</code> para criar campos personalizáveis.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="usage_instructions">Instruções de Uso</Label>
                <Textarea
                  id="usage_instructions"
                  value={formData.usage_instructions || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, usage_instructions: e.target.value })
                  }}
                  placeholder="Ex: Cole o texto do artigo científico ou forneça o link. O agente irá extrair os principais insights e gerar um resumo em linguagem acessível. Você pode especificar o tamanho do resumo ou áreas de foco."
                  rows={6}
                  maxLength={2000}
                />
                <p className="text-xs text-muted-foreground">
                  Instruções detalhadas de como usar o agente. Inclua exemplos de entrada, formato esperado e dicas de uso. 
                  Máximo 2000 caracteres.
                </p>
                {formData.usage_instructions && (
                  <p className="text-xs text-muted-foreground">
                    {formData.usage_instructions.length}/2000 caracteres
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="expected_result">Resultado Esperado</Label>
                <Textarea
                  id="expected_result"
                  value={formData.expected_result || ''}
                  onChange={(e) => {
                    setFormData({ ...formData, expected_result: e.target.value })
                  }}
                  placeholder="Ex: Você receberá um resumo estruturado com: objetivos do estudo, metodologia resumida, resultados principais e conclusões. O resumo será em linguagem clara e acessível, mantendo a precisão científica."
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  Descreva claramente o que o usuário receberá ao usar este agente. Inclua formato de saída e exemplos quando possível.
                  Máximo 1000 caracteres.
                </p>
                {formData.expected_result && (
                  <p className="text-xs text-muted-foreground">
                    {formData.expected_result.length}/1000 caracteres
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Base de Conhecimento (Arquivos)</Label>
                <div className="border-2 border-dashed rounded-lg p-4">
                  <div className="flex flex-col items-center justify-center gap-2">
                    {uploadingFile ? (
                      <>
                        <Loader2 className="h-8 w-8 text-primary animate-spin" />
                        <div className="w-full space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground truncate mr-2" title={uploadingFileName}>
                              Enviando: {uploadingFileName}
                            </span>
                            <span className="font-medium flex-shrink-0">{uploadProgress}%</span>
                          </div>
                          <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
                            <div
                              className="bg-primary h-2.5 rounded-full transition-all duration-200 ease-out"
                              style={{ width: `${Math.max(5, uploadProgress)}%` }}
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <Upload className="h-8 w-8 text-muted-foreground" />
                        <div className="text-center">
                          <Label
                            htmlFor="knowledge-file-upload"
                            className="cursor-pointer text-sm font-medium text-primary hover:underline"
                          >
                            Clique para fazer upload
                          </Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            PDF, TXT, DOCX ou MD (máx. 100MB por arquivo)
                          </p>
                          <input
                            id="knowledge-file-upload"
                            type="file"
                            className="hidden"
                            accept=".pdf,.txt,.docx,.md"
                            onChange={handleFileUpload}
                            disabled={uploadingFile}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {knowledgeFiles.length > 0 && (
                  <div className="space-y-2 mt-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      Arquivos anexados ({knowledgeFiles.length}):
                    </p>
                    {knowledgeFiles.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-2 border rounded-lg bg-muted/20"
                      >
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <File className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm truncate" title={file.name}>{file.name}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          className="flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Arquivos anexados servirão como base de conhecimento para o agente. O conteúdo será processado e incorporado ao contexto.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                />
                <Label htmlFor="active">Agente ativo</Label>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => {
                  setOpenDialog(false)
                  resetForm()
                }}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingAgent ? 'Atualizar' : 'Criar'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteAgentId} onOpenChange={() => setDeleteAgentId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir este agente? Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
