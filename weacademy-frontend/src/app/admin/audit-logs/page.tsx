'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  AlertCircle, 
  Loader2, 
  Search, 
  RefreshCw,
  Download,
  Eye
} from 'lucide-react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface AuditLog {
  id: string
  user_email: string
  user_name: string
  action: 'INSERT' | 'UPDATE' | 'DELETE'
  action_label: string
  table_name: string
  table_label: string
  row_id: string
  created_at: string
  old_data: any
  new_data: any
}

export default function AuditLogsPage() {
  const { user, isAdmin } = useAuth()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState({
    action: '',
    table_name: '',
    search: ''
  })
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const pageSize = 20

  // Carregar logs
  const fetchLogs = async () => {
    if (!user || !isAdmin) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .rpc('get_audit_logs', {
          p_limit: pageSize,
          p_offset: page * pageSize,
          p_action: filters.action || null,
          p_table_name: filters.table_name || null
        })

      if (error) throw error

      setLogs(data || [])
    } catch (error) {
      console.error('Erro ao carregar logs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Carregar total de logs
  const fetchTotal = async () => {
    if (!user || !isAdmin) return

    try {
      const { data, error } = await supabase
        .rpc('count_audit_logs', {
          p_action: filters.action || null,
          p_table_name: filters.table_name || null
        })

      if (error) throw error
      setTotal(data || 0)
    } catch (error) {
      console.error('Erro ao contar logs:', error)
    }
  }

  useEffect(() => {
    if (user && isAdmin) {
      fetchLogs()
      fetchTotal()
    }
  }, [user, isAdmin, page, filters.action, filters.table_name])

  // Verificar acesso
  if (!user || !isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center space-x-2">
              <AlertCircle className="h-5 w-5" />
              <span>Acesso Negado</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>Apenas administradores podem acessar os logs de auditoria.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('pt-BR')
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'INSERT':
        return 'bg-green-500 hover:bg-green-600'
      case 'UPDATE':
        return 'bg-blue-500 hover:bg-blue-600'
      case 'DELETE':
        return 'bg-red-500 hover:bg-red-600'
      default:
        return 'bg-gray-500 hover:bg-gray-600'
    }
  }

  const filteredLogs = logs.filter(log => {
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      return (
        log.user_email?.toLowerCase().includes(searchLower) ||
        log.user_name?.toLowerCase().includes(searchLower) ||
        log.table_label?.toLowerCase().includes(searchLower) ||
        log.action_label?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center space-x-2">
              <Shield className="h-8 w-8 text-primary" />
              <span>Logs de Auditoria</span>
            </h1>
            <p className="text-muted-foreground mt-1">
              Registro de todas as ações realizadas no sistema
            </p>
          </div>
          <div className="flex space-x-2">
            <Button variant="outline" onClick={fetchLogs} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Exportar
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total de Logs</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Criações</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {logs.filter(l => l.action === 'INSERT').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Atualizações</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {logs.filter(l => l.action === 'UPDATE').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Exclusões</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {logs.filter(l => l.action === 'DELETE').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
            <CardDescription>Filtrar logs por tipo de ação ou tabela</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="search">Buscar</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Email, nome, tabela..."
                    value={filters.search}
                    onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="action">Ação</Label>
                <Select
                  value={filters.action || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, action: value === 'all' ? '' : value }))}
                >
                  <SelectTrigger id="action">
                    <SelectValue placeholder="Todas as ações" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="INSERT">Criar</SelectItem>
                    <SelectItem value="UPDATE">Atualizar</SelectItem>
                    <SelectItem value="DELETE">Excluir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="table">Tabela</Label>
                <Select
                  value={filters.table_name || 'all'}
                  onValueChange={(value) => setFilters(prev => ({ ...prev, table_name: value === 'all' ? '' : value }))}
                >
                  <SelectTrigger id="table">
                    <SelectValue placeholder="Todas as tabelas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="profiles">Perfis</SelectItem>
                    <SelectItem value="courses">Cursos</SelectItem>
                    <SelectItem value="notifications">Notificações</SelectItem>
                    <SelectItem value="enrollments">Matrículas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Registros de Auditoria</CardTitle>
            <CardDescription>
              Mostrando {filteredLogs.length} de {total} registros
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Ação</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>ID do Registro</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          Nenhum log encontrado
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-sm">
                            {formatDate(log.created_at)}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{log.user_name || 'Sistema'}</div>
                              <div className="text-sm text-muted-foreground">{log.user_email}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(log.action)}>
                              {log.action_label}
                            </Badge>
                          </TableCell>
                          <TableCell>{log.table_label}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.row_id?.substring(0, 8)}...
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedLog(log)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Detalhes
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {total > pageSize && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Página {page + 1} de {Math.ceil(total / pageSize)}
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(0, p - 1))}
                    disabled={page === 0 || loading}
                  >
                    Anterior
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => p + 1)}
                    disabled={page >= Math.ceil(total / pageSize) - 1 || loading}
                  >
                    Próxima
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialog de Detalhes */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes do Log</DialogTitle>
              <DialogDescription>
                Informações completas sobre a ação registrada
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="font-semibold">ID do Log</Label>
                <p className="text-sm font-mono">{selectedLog.id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="font-semibold">Data/Hora</Label>
                  <p className="text-sm">{formatDate(selectedLog.created_at)}</p>
                </div>
                <div>
                  <Label className="font-semibold">Ação</Label>
                  <Badge className={getActionBadgeColor(selectedLog.action)}>
                    {selectedLog.action_label}
                  </Badge>
                </div>
              </div>
              <div>
                <Label className="font-semibold">Usuário</Label>
                <p className="text-sm">{selectedLog.user_name || 'Sistema'}</p>
                <p className="text-sm text-muted-foreground">{selectedLog.user_email}</p>
              </div>
              <div>
                <Label className="font-semibold">Tabela</Label>
                <p className="text-sm">{selectedLog.table_label} ({selectedLog.table_name})</p>
              </div>
              <div>
                <Label className="font-semibold">ID do Registro</Label>
                <p className="text-sm font-mono">{selectedLog.row_id}</p>
              </div>
              {selectedLog.old_data && (
                <div>
                  <Label className="font-semibold">Dados Anteriores</Label>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}
              {selectedLog.new_data && (
                <div>
                  <Label className="font-semibold">Novos Dados</Label>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
