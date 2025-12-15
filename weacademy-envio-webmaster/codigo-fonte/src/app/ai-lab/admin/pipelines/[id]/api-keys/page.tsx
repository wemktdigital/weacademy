'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { ApiKey } from '@/lib/validations/apiKey.schema'
import { Copy, Plus, Trash2, Eye, EyeOff, Calendar } from 'lucide-react'

export default function PipelineApiKeysPage() {
  const params = useParams()
  const router = useRouter()
  const pipelineId = params.id as string

  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [openDialog, setOpenDialog] = useState(false)
  const [deleteKeyId, setDeleteKeyId] = useState<string | null>(null)
  const [newApiKey, setNewApiKey] = useState<string | null>(null)
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({})
  const [formData, setFormData] = useState({
    name: '',
    rate_limit_per_minute: 60,
    rate_limit_per_hour: 1000,
    rate_limit_per_day: 10000,
    expires_at: '',
  })

  useEffect(() => {
    fetchApiKeys()
  }, [pipelineId])

  const fetchApiKeys = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}/api-keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch API keys')
      const data = await response.json()
      setApiKeys(data.api_keys || [])
    } catch (error) {
      console.error('Error fetching API keys:', error)
      toast.error('Erro ao carregar API keys')
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}/api-keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao criar API key')
      }

      const data = await response.json()
      setNewApiKey(data.api_key.api_key)
      toast.success('API key criada com sucesso! Salve esta chave - ela não será exibida novamente.')
      setFormData({
        name: '',
        rate_limit_per_minute: 60,
        rate_limit_per_hour: 1000,
        rate_limit_per_day: 10000,
        expires_at: '',
      })
      fetchApiKeys()
    } catch (error: any) {
      console.error('Error creating API key:', error)
      toast.error(error.message || 'Erro ao criar API key')
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    toast.success('Copiado para a área de transferência!')
  }

  const handleDelete = async () => {
    if (!deleteKeyId) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}/api-keys/${deleteKeyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to delete API key')

      toast.success('API key deletada!')
      setDeleteKeyId(null)
      fetchApiKeys()
    } catch (error) {
      console.error('Error deleting API key:', error)
      toast.error('Erro ao deletar API key')
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Carregando API keys...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">API Keys do Pipeline</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie chaves de acesso para este pipeline
          </p>
        </div>
        <Button onClick={() => setOpenDialog(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Nova API Key
        </Button>
      </div>

      {/* Exibir nova API key se acabou de ser criada */}
      {newApiKey && (
        <Card className="border-green-500 bg-green-50 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="text-green-700 dark:text-green-400">
              ⚠️ API Key Criada - Salve Agora!
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-green-700 dark:text-green-400">
              Esta é a única vez que você verá esta API key. Copie e guarde em um local seguro.
            </p>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                readOnly
                value={newApiKey}
                className="font-mono"
              />
              <Button
                variant="outline"
                onClick={() => handleCopy(newApiKey)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <Button
              variant="outline"
              onClick={() => setNewApiKey(null)}
            >
              Fechar
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4">
        {apiKeys.map((key) => (
          <Card key={key.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{key.name}</CardTitle>
                  <div className="flex gap-2 mt-2">
                    <Badge variant={key.enabled ? 'default' : 'secondary'}>
                      {key.enabled ? 'Ativa' : 'Inativa'}
                    </Badge>
                    {key.expires_at && new Date(key.expires_at) < new Date() && (
                      <Badge variant="destructive">Expirada</Badge>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => setDeleteKeyId(key.id!)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Rate Limit (minuto)</Label>
                  <p className="font-semibold">{key.rate_limit_per_minute}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rate Limit (hora)</Label>
                  <p className="font-semibold">{key.rate_limit_per_hour}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Rate Limit (dia)</Label>
                  <p className="font-semibold">{key.rate_limit_per_day}</p>
                </div>
              </div>

              {key.last_used_at && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Último uso: {new Date(key.last_used_at).toLocaleString('pt-BR')}
                  </span>
                </div>
              )}

              {key.total_requests !== undefined && (
                <div className="text-sm text-muted-foreground">
                  Total de requests: {key.total_requests}
                </div>
              )}

              {key.expires_at && (
                <div className="text-sm text-muted-foreground">
                  Expira em: {new Date(key.expires_at).toLocaleDateString('pt-BR')}
                </div>
              )}

              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground">API Key:</Label>
                <div className="flex items-center gap-2 flex-1">
                  <Input
                    type={showApiKey[key.id!] ? 'text' : 'password'}
                    readOnly
                    value={key.api_key || 'wak_***'}
                    className="font-mono"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowApiKey({ ...showApiKey, [key.id!]: !showApiKey[key.id!] })}
                  >
                    {showApiKey[key.id!] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {key.api_key && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCopy(key.api_key!)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {apiKeys.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Nenhuma API key configurada. Clique em "Nova API Key" para começar.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de criação */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova API Key</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: API Key Produção"
                required
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="rate_limit_per_minute">Por Minuto</Label>
                <Input
                  id="rate_limit_per_minute"
                  type="number"
                  min="1"
                  max="1000"
                  value={formData.rate_limit_per_minute}
                  onChange={(e) => setFormData({ ...formData, rate_limit_per_minute: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="rate_limit_per_hour">Por Hora</Label>
                <Input
                  id="rate_limit_per_hour"
                  type="number"
                  min="1"
                  max="100000"
                  value={formData.rate_limit_per_hour}
                  onChange={(e) => setFormData({ ...formData, rate_limit_per_hour: parseInt(e.target.value) })}
                />
              </div>
              <div>
                <Label htmlFor="rate_limit_per_day">Por Dia</Label>
                <Input
                  id="rate_limit_per_day"
                  type="number"
                  min="1"
                  max="1000000"
                  value={formData.rate_limit_per_day}
                  onChange={(e) => setFormData({ ...formData, rate_limit_per_day: parseInt(e.target.value) })}
                />
              </div>
            </div>

            <div>
              <Label htmlFor="expires_at">Data de Expiração (opcional)</Label>
              <Input
                id="expires_at"
                type="datetime-local"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">Criar API Key</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteKeyId} onOpenChange={(open) => !open && setDeleteKeyId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta API key? Esta ação não pode ser desfeita.
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

