'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import { toast } from 'sonner'

interface MemoryItem {
  id: number
  agent_id: string | null
  key: string
  value: string
  importance: number
  updated_at: string
}

export default function MemoryPage() {
  const [memories, setMemories] = useState<MemoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteKey, setDeleteKey] = useState<string | null>(null)

  useEffect(() => {
    fetchMemories()
  }, [])

  const fetchMemories = async () => {
    try {
      const response = await fetch('/api/lab-ia/memory')
      if (!response.ok) throw new Error('Failed to fetch memories')
      const data = await response.json()
      setMemories(data.memories || [])
    } catch (error) {
      console.error('Error fetching memories:', error)
      toast.error('Erro ao carregar memórias')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (key: string, agentId?: string | null) => {
    try {
      const params = agentId ? `?agentId=${agentId}` : ''
      const response = await fetch(`/api/lab-ia/memory/${encodeURIComponent(key)}${params}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to delete memory')

      toast.success('Memória excluída com sucesso!')
      setDeleteKey(null)
      fetchMemories()
    } catch (error) {
      console.error('Error deleting memory:', error)
      toast.error('Erro ao excluir memória')
    }
  }

  const handleClearAll = async () => {
    try {
      const response = await fetch('/api/lab-ia/memory', {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to clear memories')

      toast.success('Todas as memórias foram excluídas!')
      setDeleteKey(null)
      fetchMemories()
    } catch (error) {
      console.error('Error clearing memories:', error)
      toast.error('Erro ao limpar memórias')
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

  const globalMemories = memories.filter(m => !m.agent_id)
  const agentMemories = memories.filter(m => m.agent_id)

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">🧠 Memória dos Agentes</h1>
            <p className="text-muted-foreground mt-1">
              Gerencie suas preferências e memórias salvas
            </p>
          </div>
          {memories.length > 0 && (
            <Button variant="destructive" onClick={() => setDeleteKey('ALL')}>
              Limpar Tudo
            </Button>
          )}
        </div>

        {/* Memórias Globais */}
        {globalMemories.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Memórias Globais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {globalMemories.map((memory) => (
                <div key={memory.id} className="flex items-start justify-between p-3 border rounded-lg">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(memory.key, null)}
                  >
                    ×
                  </Button>
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
                <div key={memory.id} className="flex items-start justify-between p-3 border rounded-lg">
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
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(memory.key, memory.agent_id)}
                  >
                    ×
                  </Button>
                </div>
              ))}
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
