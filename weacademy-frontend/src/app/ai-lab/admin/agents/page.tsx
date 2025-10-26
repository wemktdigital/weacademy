'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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
import type { Agent } from '@/lib/validations/agent.schema'

export default function AgentsAdminPage() {
  const router = useRouter()
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
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
  })

  useEffect(() => {
    fetchAgents()
  }, [])

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/agents')
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
      toast.error('Erro ao carregar agentes')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const url = editingAgent
        ? `/api/lab-ia/admin/agents/${editingAgent.id}`
        : '/api/lab-ia/admin/agents'
      
      const method = editingAgent ? 'PUT' : 'POST'
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) throw new Error('Failed to save agent')

      toast.success(
        editingAgent ? 'Agente atualizado com sucesso!' : 'Agente criado com sucesso!'
      )
      
      setOpenDialog(false)
      resetForm()
      fetchAgents()
    } catch (error) {
      console.error('Error saving agent:', error)
      toast.error('Erro ao salvar agente')
    }
  }

  const handleDelete = async () => {
    if (!deleteAgentId) return

    try {
      const response = await fetch(`/api/lab-ia/admin/agents/${deleteAgentId}`, {
        method: 'DELETE',
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
      prompt: '',
      category: '',
      active: true,
    })
    setEditingAgent(null)
  }

  const handleEdit = (agent: Agent) => {
    setEditingAgent(agent)
    setFormData(agent)
    setOpenDialog(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando agentes...</p>
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
            <h1 className="text-3xl font-bold tracking-tight">Gerenciar Agentes</h1>
            <p className="text-muted-foreground mt-1">
              Crie e gerencie agentes de IA para o Laboratório
            </p>
          </div>
          <Button onClick={() => {
            resetForm()
            setOpenDialog(true)
          }}>
            + Novo Agente
          </Button>
        </div>

        {/* Agents List */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <Card key={agent.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{agent.icon || '🤖'}</span>
                      <CardTitle className="text-lg">{agent.name}</CardTitle>
                    </div>
                    <Badge className="mt-2" variant={agent.active ? 'default' : 'secondary'}>
                      {agent.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {agent.description || 'Sem descrição'}
                </p>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tipo:</span>
                    <Badge variant="outline">{agent.type}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Provedor:</span>
                    <span>{agent.provider || 'N/A'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Categoria:</span>
                    <span>{agent.category || 'N/A'}</span>
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
                  <Label htmlFor="provider">Provedor</Label>
                  <Input
                    id="provider"
                    value={formData.provider}
                    onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
                    placeholder="Ex: OpenAI"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Modelo</Label>
                  <Input
                    id="model"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Ex: gpt-4o-mini"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">Prompt Base *</Label>
                <Textarea
                  id="prompt"
                  value={formData.prompt}
                  onChange={(e) => setFormData({ ...formData, prompt: e.target.value })}
                  placeholder="Instruções para o agente..."
                  rows={8}
                  required
                />
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
