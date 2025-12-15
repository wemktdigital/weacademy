'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { KnowledgeBase, KnowledgeBaseFormData } from '@/lib/validations/knowledgeBase.schema'
import type { Agent } from '@/lib/validations/agent.schema'
import { BookOpen, Plus, Trash2, Edit, Upload, FileText, Globe, User } from 'lucide-react'
import Link from 'next/link'

export default function KnowledgeBasesPage() {
  const [knowledgeBases, setKnowledgeBases] = useState<(KnowledgeBase & { agent?: Agent })[]>([])
  const [agents, setAgents] = useState<Agent[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deleteKbId, setDeleteKbId] = useState<string | null>(null)
  const [editingKb, setEditingKb] = useState<KnowledgeBase | null>(null)
  const [formData, setFormData] = useState<Partial<KnowledgeBaseFormData>>({
    name: '',
    description: '',
    is_global: false,
    chunk_size: 1000,
    chunk_overlap: 200,
    enabled: true,
  })

  useEffect(() => {
    fetchKnowledgeBases()
    fetchAgents()
  }, [])

  const fetchKnowledgeBases = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token
      const headers: Record<string, string> = {}
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch('/api/lab-ia/admin/knowledge-bases', {
        headers,
        credentials: 'include',
      })

      if (!response.ok) throw new Error('Failed to fetch knowledge bases')
      const data = await response.json()
      setKnowledgeBases(data.knowledge_bases || [])
    } catch (error) {
      console.error('Error fetching knowledge bases:', error)
      toast.error('Erro ao carregar knowledge bases')
    } finally {
      setLoading(false)
    }
  }

  const fetchAgents = async () => {
    try {
      const response = await fetch('/api/lab-ia/agents')
      if (!response.ok) throw new Error('Failed to fetch agents')
      const data = await response.json()
      setAgents(data.agents || [])
    } catch (error) {
      console.error('Error fetching agents:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name) {
      toast.error('Nome é obrigatório')
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const url = editingKb
        ? `/api/lab-ia/admin/knowledge-bases/${editingKb.id}`
        : '/api/lab-ia/admin/knowledge-bases'

      const method = editingKb ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao salvar knowledge base')
      }

      toast.success(editingKb ? 'Knowledge base atualizada!' : 'Knowledge base criada!')
      setOpenDialog(false)
      resetForm()
      fetchKnowledgeBases()
    } catch (error: any) {
      console.error('Error saving knowledge base:', error)
      toast.error(error.message || 'Erro ao salvar knowledge base')
    }
  }

  const handleDelete = async () => {
    if (!deleteKbId) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/knowledge-bases/${deleteKbId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to delete knowledge base')

      toast.success('Knowledge base deletada!')
      setDeleteKbId(null)
      fetchKnowledgeBases()
    } catch (error) {
      console.error('Error deleting knowledge base:', error)
      toast.error('Erro ao deletar knowledge base')
    }
  }

  const handleEdit = (kb: KnowledgeBase) => {
    setEditingKb(kb)
    setFormData({
      agent_id: kb.agent_id || undefined,
      name: kb.name,
      description: kb.description,
      is_global: kb.is_global,
      chunk_size: kb.chunk_size,
      chunk_overlap: kb.chunk_overlap,
      enabled: kb.enabled,
    })
    setOpenDialog(true)
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      is_global: false,
      chunk_size: 1000,
      chunk_overlap: 200,
      enabled: true,
    })
    setEditingKb(null)
  }

  const handleGlobalChange = (isGlobal: boolean) => {
    setFormData({
      ...formData,
      is_global: isGlobal,
      agent_id: isGlobal ? undefined : formData.agent_id,
    })
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Carregando knowledge bases...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Bases</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie bases de conhecimento para agentes com RAG
          </p>
        </div>
        <Button onClick={() => { resetForm(); setOpenDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova Knowledge Base
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {knowledgeBases.map((kb) => (
          <Card key={kb.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {kb.is_global ? (
                      <Globe className="h-4 w-4 text-blue-500" />
                    ) : (
                      <User className="h-4 w-4 text-purple-500" />
                    )}
                    {kb.name}
                  </CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={kb.enabled ? 'default' : 'secondary'}>
                      {kb.enabled ? 'Ativa' : 'Inativa'}
                    </Badge>
                    {kb.is_global && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400 border-blue-500">
                        Global
                      </Badge>
                    )}
                    {kb.agent && (
                      <Badge variant="outline" className="bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-400 border-purple-500">
                        {kb.agent.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {kb.description && (
                <p className="text-sm text-muted-foreground">{kb.description}</p>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Label className="text-muted-foreground">Documentos</Label>
                  <p className="font-semibold">{kb.total_documents || 0}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Chunks</Label>
                  <p className="font-semibold">{kb.total_chunks || 0}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Label className="text-muted-foreground">Chunk Size</Label>
                  <p className="font-semibold">{kb.chunk_size}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Overlap</Label>
                  <p className="font-semibold">{kb.chunk_overlap}</p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Link href={`/ai-lab/admin/knowledge-bases/${kb.id}/documents`}>
                  <Button size="sm" variant="outline" className="flex-1">
                    <FileText className="h-3 w-3 mr-1" />
                    Documentos
                  </Button>
                </Link>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleEdit(kb)}
                >
                  <Edit className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteKbId(kb.id!)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {knowledgeBases.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhuma knowledge base configurada. Clique em "Nova Knowledge Base" para começar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de criação/edição */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingKb ? 'Editar Knowledge Base' : 'Nova Knowledge Base'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center gap-2">
              <Switch
                id="is_global"
                checked={formData.is_global}
                onCheckedChange={handleGlobalChange}
              />
              <Label htmlFor="is_global">Knowledge Base Global (para todos os agentes)</Label>
            </div>

            {!formData.is_global && (
              <div>
                <Label htmlFor="agent_id">Agente</Label>
                <Select
                  value={formData.agent_id}
                  onValueChange={(value) => setFormData({ ...formData, agent_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {agents.filter(a => a.active).map((agent) => (
                      <SelectItem key={agent.id} value={agent.id!}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Base de Conhecimento Médico"
              />
            </div>

            <div>
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional da knowledge base"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="chunk_size">Tamanho do Chunk (caracteres)</Label>
                <Input
                  id="chunk_size"
                  type="number"
                  min="100"
                  max="5000"
                  value={formData.chunk_size}
                  onChange={(e) => setFormData({ ...formData, chunk_size: parseInt(e.target.value) || 1000 })}
                />
              </div>
              <div>
                <Label htmlFor="chunk_overlap">Overlap (caracteres)</Label>
                <Input
                  id="chunk_overlap"
                  type="number"
                  min="0"
                  max="1000"
                  value={formData.chunk_overlap}
                  onChange={(e) => setFormData({ ...formData, chunk_overlap: parseInt(e.target.value) || 200 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="enabled"
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
              />
              <Label htmlFor="enabled">Ativa</Label>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setOpenDialog(false); resetForm() }}>
                Cancelar
              </Button>
              <Button type="submit">Salvar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteKbId} onOpenChange={(open) => !open && setDeleteKbId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta knowledge base? Todos os documentos e chunks serão deletados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

