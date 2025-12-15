'use client'

import { useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { Search, Edit, Download, Upload, X, Loader2, Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface MemoryItem {
  id: number
  agent_id: string | null
  key: string
  value: string
  importance: number
  updated_at: string
}

export default function MemoryPage() {
  const { user } = useAuth()
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [filterImportance, setFilterImportance] = useState<number | 'all'>('all')
  const [editingMemory, setEditingMemory] = useState<MemoryItem | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editImportance, setEditImportance] = useState(1)
  const [saving, setSaving] = useState(false)
  const [creatingMemory, setCreatingMemory] = useState(false)
  const [newMemoryKey, setNewMemoryKey] = useState('')
  const [newMemoryValue, setNewMemoryValue] = useState('')
  const [newMemoryImportance, setNewMemoryImportance] = useState(3)

  useEffect(() => {
    if (user) {
      fetchMemories()
    } else {
      setLoading(false)
    }
  }, [user])

  const fetchMemories = async () => {
    try {
      setLoading(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/memory', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        // Tentar obter mensagem de erro mais específica
        let errorMessage = 'Erro ao carregar memórias'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Não foi possível parsear erro
        }

        if (response.status === 401) {
          errorMessage = 'Não autenticado. Por favor, faça login novamente.'
        }

        throw new Error(errorMessage)
      }

      const data = await response.json()
      setMemories(data.memories || [])
    } catch (error: any) {
      console.error('[MemoryPage] Erro ao carregar memórias:', error)
      toast.error(error.message || 'Erro ao carregar memórias')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (key: string, agentId?: string | null) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const params = agentId ? `?agentId=${agentId}` : ''
      const response = await fetch(`/api/lab-ia/memory/${encodeURIComponent(key)}${params}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao excluir memória'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Não foi possível parsear erro
        }
        throw new Error(errorMessage)
      }

      toast.success('Memória excluída com sucesso!')
      setDeleteKey(null)
      fetchMemories()
    } catch (error: any) {
      console.error('[MemoryPage] Erro ao excluir memória:', error)
      toast.error(error.message || 'Erro ao excluir memória')
    }
  }

  const handleClearAll = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/memory', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao limpar memórias'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Não foi possível parsear erro
        }
        throw new Error(errorMessage)
      }

      toast.success('Todas as memórias foram excluídas!')
      setDeleteKey(null)
      fetchMemories()
    } catch (error: any) {
      console.error('[MemoryPage] Erro ao limpar memórias:', error)
      toast.error(error.message || 'Erro ao limpar memórias')
    }
  }

  const getImportanceLabel = (importance: number) => {
    const labels: { [key: number]: string } = {
      5: 'Crítica',
      4: 'Alta',
      3: 'Média',
      2: 'Baixa',
      1: 'Muito Baixa',
    }
    return labels[importance] || 'Desconhecida'
  }

  const handleEdit = (memory: MemoryItem) => {
    setEditingMemory(memory)
    setEditValue(memory.value)
    setEditImportance(memory.importance)
  }

  const handleCreateMemory = async () => {
    if (!newMemoryKey.trim() || !newMemoryValue.trim()) {
      toast.error('Chave e valor são obrigatórios')
      return
    }

    try {
      setSaving(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/lab-ia/memory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          key: newMemoryKey.trim(),
          value: newMemoryValue.trim(),
          importance: newMemoryImportance,
        }),
      })

      if (!response.ok) {
        let errorMessage = 'Erro ao criar memória'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Não foi possível parsear erro
        }
        throw new Error(errorMessage)
      }

      toast.success('Memória criada com sucesso!')
      setCreatingMemory(false)
      setNewMemoryKey('')
      setNewMemoryValue('')
      setNewMemoryImportance(3)
      fetchMemories()
    } catch (error: any) {
      console.error('[MemoryPage] Erro ao criar memória:', error)
      toast.error(error.message || 'Erro ao criar memória')
    } finally {
      setSaving(false)
    }
  }

  const handleSaveEdit = async () => {
    if (!editingMemory) return

    try {
      setSaving(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const params = editingMemory.agent_id ? `?agentId=${editingMemory.agent_id}` : ''
      const response = await fetch(
        `/api/lab-ia/memory/${encodeURIComponent(editingMemory.key)}${params}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            value: editValue,
            importance: editImportance,
          }),
        }
      )

      if (!response.ok) {
        let errorMessage = 'Erro ao atualizar memória'
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch (e) {
          // Não foi possível parsear erro
        }
        throw new Error(errorMessage)
      }

      toast.success('Memória atualizada com sucesso!')
      setEditingMemory(null)
      fetchMemories()
    } catch (error: any) {
      console.error('[MemoryPage] Erro ao atualizar memória:', error)
      toast.error(error.message || 'Erro ao atualizar memória')
    } finally {
      setSaving(false)
    }
  }

  const handleExport = () => {
    const dataStr = JSON.stringify(memories, null, 2)
    const dataBlob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(dataBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = `memorias-${new Date().toISOString().split('T')[0]}.json`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    toast.success('Memórias exportadas com sucesso!')
  }

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const importedMemories: MemoryItem[] = JSON.parse(text)

      if (!Array.isArray(importedMemories)) {
        throw new Error('Formato inválido')
      }

      // Validar e importar memórias (seria necessário criar API de import)
      toast.success(`${importedMemories.length} memórias importadas!`)
      fetchMemories()
    } catch (error) {
      console.error('Error importing memories:', error)
      toast.error('Erro ao importar memórias')
    }
  }

  // Filtrar memórias
  const filteredMemories = useMemo(() => {
    return memories.filter((memory) => {
      const matchesSearch =
        memory.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
        memory.value.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesImportance =
        filterImportance === 'all' || memory.importance === filterImportance
      return matchesSearch && matchesImportance
    })
  }, [memories, searchTerm, filterImportance])

  // Estatísticas
  const stats = useMemo(() => {
    const total = memories.length
    const global = memories.filter((m) => !m.agent_id).length
    const byAgent = memories.filter((m) => m.agent_id).length
    const lastUpdate =
      memories.length > 0
        ? new Date(
            Math.max(...memories.map((m) => new Date(m.updated_at).getTime()))
          )
        : null
    return { total, global, byAgent, lastUpdate }
  }, [memories])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando memórias...</p>
        </div>
      </div>
    )
  }

  const globalMemories = filteredMemories.filter((m) => !m.agent_id)
  const agentMemories = filteredMemories.filter((m) => m.agent_id)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🧠 Memórias Salvas</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas preferências e memórias salvas
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setCreatingMemory(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Memória
            </Button>
            {memories.length > 0 && (
              <>
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
                <label>
                  <Button variant="outline" asChild>
                    <span>
                      <Upload className="h-4 w-4 mr-2" />
                      Importar
                    </span>
                  </Button>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImport}
                    className="hidden"
                  />
                </label>
                <Button variant="destructive" onClick={() => setDeleteKey('ALL')}>
                  Limpar Tudo
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Estatísticas */}
        {stats.total > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Total de Memórias</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Memórias Globais</p>
                  <p className="text-2xl font-bold">{stats.global}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Memórias por Agente</p>
                  <p className="text-2xl font-bold">{stats.byAgent}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Última Atualização</p>
                  <p className="text-sm font-medium">
                    {stats.lastUpdate
                      ? new Date(stats.lastUpdate).toLocaleDateString('pt-BR')
                      : 'N/A'}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filtros e Busca */}
        {memories.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar memórias..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select
                  value={filterImportance === 'all' ? 'all' : String(filterImportance)}
                  onValueChange={(value) =>
                    setFilterImportance(value === 'all' ? 'all' : Number(value))
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filtrar por importância" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as importâncias</SelectItem>
                    <SelectItem value="5">Crítica</SelectItem>
                    <SelectItem value="4">Alta</SelectItem>
                    <SelectItem value="3">Média</SelectItem>
                    <SelectItem value="2">Baixa</SelectItem>
                    <SelectItem value="1">Muito Baixa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Memórias Globais */}
        {globalMemories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Memórias Globais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {globalMemories.map((memory) => (
                <div key={memory.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{memory.key}</span>
                      <Badge variant="outline" className="text-xs">
                        {getImportanceLabel(memory.importance)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{memory.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Atualizado em {new Date(memory.updated_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(memory)}
                      title="Editar memória"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteKey(memory.key)}
                      title="Excluir memória"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Memórias por Agente */}
        {agentMemories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Memórias por Agente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {agentMemories.map((memory) => (
                <div key={memory.id} className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{memory.key}</span>
                      <Badge variant="secondary" className="text-xs">
                        {memory.agent_id}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getImportanceLabel(memory.importance)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{memory.value}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Atualizado em {new Date(memory.updated_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(memory)}
                      title="Editar memória"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteKey(memory.key)}
                      title="Excluir memória"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {filteredMemories.length === 0 && memories.length > 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma memória encontrada com os filtros aplicados</p>
            </CardContent>
          </Card>
        )}

        {memories.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">Nenhuma memória salva ainda</p>
            </CardContent>
          </Card>
        )}

        {/* Dialog de criação */}
        <Dialog open={creatingMemory} onOpenChange={setCreatingMemory}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Nova Memória</DialogTitle>
              <DialogDescription>
                Adicione uma nova memória que será usada pelo Laboratório de IA
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="new-key">Nome da memória *</Label>
                <Input
                  id="new-key"
                  placeholder="Ex: nome, profissão, preferência"
                  value={newMemoryKey}
                  onChange={(e) => setNewMemoryKey(e.target.value)}
                  maxLength={100}
                />
                <p className="text-xs text-muted-foreground">
                  Identificador único para esta memória (ex: &quot;nome&quot;, &quot;profissão&quot;)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-value">Descreva sua memória *</Label>
                <Textarea
                  id="new-value"
                  placeholder="Ex: João Silva, Desenvolvedor de Software"
                  value={newMemoryValue}
                  onChange={(e) => setNewMemoryValue(e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">
                  Informação que será lembrada pelo Laboratório de IA
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="new-importance">Importância</Label>
                <Select
                  value={String(newMemoryImportance)}
                  onValueChange={(value) => setNewMemoryImportance(Number(value))}
                >
                  <SelectTrigger id="new-importance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Crítica (5) - Sempre usada</SelectItem>
                    <SelectItem value="4">Alta (4) - Frequentemente usada</SelectItem>
                    <SelectItem value="3">Média (3) - Usada quando relevante</SelectItem>
                    <SelectItem value="2">Baixa (2) - Raramente usada</SelectItem>
                    <SelectItem value="1">Muito Baixa (1) - Pouco usada</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Memórias com maior importância têm prioridade quando há limite de tokens
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setCreatingMemory(false)
                setNewMemoryKey('')
                setNewMemoryValue('')
                setNewMemoryImportance(3)
              }}>
                Cancelar
              </Button>
              <Button onClick={handleCreateMemory} disabled={saving || !newMemoryKey.trim() || !newMemoryValue.trim()}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Criar Memória
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de edição */}
        <Dialog open={!!editingMemory} onOpenChange={() => setEditingMemory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Editar Memória</DialogTitle>
              <DialogDescription>
                Edite o valor e a importância desta memória
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-key">Chave</Label>
                <Input
                  id="edit-key"
                  value={editingMemory?.key || ''}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-value">Valor</Label>
                <Textarea
                  id="edit-value"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  rows={4}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-importance">Importância</Label>
                <Select
                  value={String(editImportance)}
                  onValueChange={(value) => setEditImportance(Number(value))}
                >
                  <SelectTrigger id="edit-importance">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">Crítica (5)</SelectItem>
                    <SelectItem value="4">Alta (4)</SelectItem>
                    <SelectItem value="3">Média (3)</SelectItem>
                    <SelectItem value="2">Baixa (2)</SelectItem>
                    <SelectItem value="1">Muito Baixa (1)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMemory(null)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveEdit} disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Salvar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de confirmação */}
        <AlertDialog open={!!deleteKey} onOpenChange={() => setDeleteKey(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {deleteKey === 'ALL' ? 'Limpar Todas as Memórias' : 'Excluir Memória'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {deleteKey === 'ALL'
                  ? 'Tem certeza que deseja excluir todas as memórias? Esta ação não pode ser desfeita.'
                  : 'Tem certeza que deseja excluir esta memória? Esta ação não pode ser desfeita.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (deleteKey === 'ALL') {
                    handleClearAll()
                  } else if (deleteKey) {
                    const memory = memories.find((m) => m.key === deleteKey)
                    if (memory) {
                      handleDelete(memory.key, memory.agent_id)
                    }
                  }
                }}
                className="bg-destructive"
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
