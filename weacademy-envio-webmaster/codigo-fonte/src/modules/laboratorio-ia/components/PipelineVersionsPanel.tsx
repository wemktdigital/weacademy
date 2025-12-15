'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  GitBranch, 
  History, 
  RotateCcw, 
  Eye, 
  Tag, 
  Plus, 
  Loader2,
  ArrowLeft,
  ArrowRight,
  GitCompare,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

interface PipelineVersion {
  id: string
  pipeline_id: string
  version: string
  major: number
  minor: number
  patch: number
  name: string
  description?: string
  changelog?: string
  release_notes?: string
  is_release: boolean
  release_tag?: string
  status: 'draft' | 'published' | 'archived'
  created_at: string
  created_by: string
}

interface PipelineVersionsPanelProps {
  pipelineId: string
  pipelineName: string
}

export function PipelineVersionsPanel({
  pipelineId,
  pipelineName,
}: PipelineVersionsPanelProps) {
  const [versions, setVersions] = useState<PipelineVersion[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingVersion, setCreatingVersion] = useState(false)
  const [selectedVersion, setSelectedVersion] = useState<PipelineVersion | null>(null)
  const [comparingVersions, setComparingVersions] = useState(false)
  const [fromVersion, setFromVersion] = useState<string>('')
  const [toVersion, setToVersion] = useState<string>('')
  const [diff, setDiff] = useState<any>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newVersion, setNewVersion] = useState({
    version: '',
    change_type: 'patch' as 'major' | 'minor' | 'patch',
    changelog: '',
    release_notes: '',
    is_release: false,
    release_tag: '',
  })

  useEffect(() => {
    fetchVersions()
  }, [pipelineId])

  const fetchVersions = async () => {
    setLoading(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}/versions`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao buscar versões')
      }

      const data = await response.json()
      setVersions(data.versions || [])
    } catch (error: any) {
      console.error('Erro ao buscar versões:', error)
      toast.error(error.message || 'Erro ao buscar versões')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateVersion = async () => {
    if (!newVersion.version && !newVersion.change_type) {
      toast.error('Informe a versão ou o tipo de mudança')
      return
    }

    setCreatingVersion(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          version: newVersion.version || undefined,
          change_type: !newVersion.version ? newVersion.change_type : undefined,
          changelog: newVersion.changelog || undefined,
          release_notes: newVersion.release_notes || undefined,
          is_release: newVersion.is_release,
          release_tag: newVersion.release_tag || undefined,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao criar versão')
      }

      toast.success('Versão criada com sucesso!')
      setShowCreateDialog(false)
      setNewVersion({
        version: '',
        change_type: 'patch',
        changelog: '',
        release_notes: '',
        is_release: false,
        release_tag: '',
      })
      fetchVersions()
    } catch (error: any) {
      console.error('Erro ao criar versão:', error)
      toast.error(error.message || 'Erro ao criar versão')
    } finally {
      setCreatingVersion(false)
    }
  }

  const handleRollback = async (version: string) => {
    if (!confirm(`Tem certeza que deseja fazer rollback para a versão ${version}?`)) {
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(`/api/lab-ia/admin/pipelines/${pipelineId}/versions/${version}/rollback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify({
          changelog: `Rollback para versão ${version}`,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao fazer rollback')
      }

      toast.success('Rollback realizado com sucesso!')
      fetchVersions()
    } catch (error: any) {
      console.error('Erro ao fazer rollback:', error)
      toast.error(error.message || 'Erro ao fazer rollback')
    }
  }

  const handleCompare = async () => {
    if (!fromVersion || !toVersion) {
      toast.error('Selecione duas versões para comparar')
      return
    }

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch(
        `/api/lab-ia/admin/pipelines/${pipelineId}/versions/${toVersion}?compare=${fromVersion}`,
        {
          headers: {
            ...(token && { 'Authorization': `Bearer ${token}` }),
          },
        }
      )

      if (!response.ok) {
        throw new Error('Erro ao calcular diff')
      }

      const data = await response.json()
      setDiff(data.diff)
    } catch (error: any) {
      console.error('Erro ao comparar versões:', error)
      toast.error(error.message || 'Erro ao comparar versões')
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <GitBranch className="h-5 w-5" />
              Versões - {pipelineName}
            </CardTitle>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Versão
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {versions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma versão criada ainda</p>
              <p className="text-sm mt-2">Crie a primeira versão para começar o versionamento</p>
            </div>
          ) : (
            <div className="space-y-3">
              {versions.map((version) => (
                <div
                  key={version.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="font-mono">
                          {version.version}
                        </Badge>
                        {version.is_release && (
                          <Badge variant="default" className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            {version.release_tag || 'Release'}
                          </Badge>
                        )}
                        <Badge variant={version.status === 'published' ? 'default' : 'secondary'}>
                          {version.status === 'published' ? 'Publicado' : version.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                        </Badge>
                      </div>
                      <p className="text-sm font-semibold">{version.name}</p>
                      {version.changelog && (
                        <p className="text-sm text-muted-foreground mt-1">{version.changelog}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        Criado em {new Date(version.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedVersion(version)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {version.status === 'published' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRollback(version.version)}
                        >
                          <RotateCcw className="h-4 w-4 mr-1" />
                          Rollback
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparar versões */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <GitCompare className="h-5 w-5" />
            Comparar Versões
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Versão Inicial</Label>
              <Select value={fromVersion} onValueChange={setFromVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione versão" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.version}>
                      {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Versão Final</Label>
              <Select value={toVersion} onValueChange={setToVersion}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione versão" />
                </SelectTrigger>
                <SelectContent>
                  {versions.map((v) => (
                    <SelectItem key={v.id} value={v.version}>
                      {v.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCompare} disabled={!fromVersion || !toVersion}>
            <GitCompare className="h-4 w-4 mr-2" />
            Comparar
          </Button>
          {diff && (
            <div className="mt-4 border rounded-lg p-4">
              <h4 className="font-semibold mb-2">Diferenças:</h4>
              <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                {JSON.stringify(diff, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para criar versão */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Criar Nova Versão</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Versão (opcional)</Label>
                <Input
                  placeholder="v1.0.0"
                  value={newVersion.version}
                  onChange={(e) => setNewVersion({ ...newVersion, version: e.target.value })}
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Deixe em branco para calcular automaticamente
                </p>
              </div>
              <div>
                <Label>Tipo de Mudança (se versão não fornecida)</Label>
                <Select
                  value={newVersion.change_type}
                  onValueChange={(value: 'major' | 'minor' | 'patch') =>
                    setNewVersion({ ...newVersion, change_type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="patch">Patch (1.0.0 → 1.0.1)</SelectItem>
                    <SelectItem value="minor">Minor (1.0.0 → 1.1.0)</SelectItem>
                    <SelectItem value="major">Major (1.0.0 → 2.0.0)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Changelog</Label>
              <Textarea
                placeholder="Descreva as mudanças nesta versão..."
                value={newVersion.changelog}
                onChange={(e) => setNewVersion({ ...newVersion, changelog: e.target.value })}
                rows={3}
              />
            </div>
            <div>
              <Label>Release Notes (opcional)</Label>
              <Textarea
                placeholder="Notas de release..."
                value={newVersion.release_notes}
                onChange={(e) => setNewVersion({ ...newVersion, release_notes: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_release"
                  checked={newVersion.is_release}
                  onChange={(e) => setNewVersion({ ...newVersion, is_release: e.target.checked })}
                />
                <Label htmlFor="is_release">É uma release oficial</Label>
              </div>
              {newVersion.is_release && (
                <div className="flex-1">
                  <Label>Tag da Release</Label>
                  <Input
                    placeholder="stable, beta, v1.0.0"
                    value={newVersion.release_tag}
                    onChange={(e) => setNewVersion({ ...newVersion, release_tag: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateVersion} disabled={creatingVersion}>
                {creatingVersion ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  'Criar Versão'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog para ver detalhes da versão */}
      {selectedVersion && (
        <Dialog open={!!selectedVersion} onOpenChange={() => setSelectedVersion(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Versão {selectedVersion.version}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome</Label>
                <p className="text-sm">{selectedVersion.name}</p>
              </div>
              {selectedVersion.description && (
                <div>
                  <Label>Descrição</Label>
                  <p className="text-sm">{selectedVersion.description}</p>
                </div>
              )}
              {selectedVersion.changelog && (
                <div>
                  <Label>Changelog</Label>
                  <p className="text-sm">{selectedVersion.changelog}</p>
                </div>
              )}
              {selectedVersion.release_notes && (
                <div>
                  <Label>Release Notes</Label>
                  <p className="text-sm">{selectedVersion.release_notes}</p>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Label>Status:</Label>
                <Badge>{selectedVersion.status}</Badge>
                {selectedVersion.is_release && (
                  <>
                    <Label>Release:</Label>
                    <Badge>{selectedVersion.release_tag || 'Release'}</Badge>
                  </>
                )}
              </div>
              <div>
                <Label>Criado em</Label>
                <p className="text-sm">{new Date(selectedVersion.created_at).toLocaleString('pt-BR')}</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

