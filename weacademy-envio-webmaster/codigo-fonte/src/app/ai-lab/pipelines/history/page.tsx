'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { PipelineExecutionCard } from '@/modules/laboratorio-ia/components/PipelineExecutionCard'
import { PipelineExecutionModal } from '@/modules/laboratorio-ia/components/PipelineExecutionModal'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'
import { History, Search, Filter, X } from 'lucide-react'
import Link from 'next/link'

interface Execution {
  id: string | number
  created_at: string
  steps_executed: number
  total_latency_ms: number
  total_cost_usd: number | string
  pipeline?: {
    id: string
    name: string
    description?: string
  } | null
  user?: {
    id: string
    email?: string
    full_name?: string
  } | null
  output_messages?: any[]
  input_messages?: any[]
}

export default function PipelineHistoryPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()
  const [executions, setExecutions] = useState<Execution[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedExecution, setSelectedExecution] = useState<Execution | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Filtros
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [selectedPipeline, setSelectedPipeline] = useState<string>('')
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')
  const [endDate, setEndDate] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState<string>('')
  
  // Dados para filtros
  const [pipelines, setPipelines] = useState<any[]>([])
  const [users, setUsers] = useState<any[]>([])

  useEffect(() => {
    if (user) {
      loadExecutions()
      loadFilters()
    }
  }, [user, page, selectedPipeline, selectedUser, startDate, endDate, searchQuery])

  const loadFilters = async () => {
    try {
      // Carregar pipelines
      const { data: pipelinesData } = await supabase
        .from('lab_agent_pipelines')
        .select('id, name')
        .eq('active', true)
        .order('name')
      
      setPipelines(pipelinesData || [])

      // Carregar usuários (apenas se admin)
      if (isAdmin) {
        // Buscar usuários que têm execuções de pipeline
        const { data: usersData } = await supabase
          .from('profiles')
          .select('id, email, full_name')
          .in('role', ['admin', 'user'])
          .order('full_name')
        
        setUsers(usersData || [])
      }
    } catch (error) {
      console.error('Erro ao carregar filtros:', error)
    }
  }

  const loadExecutions = async () => {
    try {
      setLoading(true)
      
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      })

      if (selectedPipeline) params.append('pipeline_id', selectedPipeline)
      if (selectedUser && isAdmin) params.append('user_id', selectedUser)
      if (startDate) params.append('start_date', startDate)
      if (endDate) params.append('end_date', endDate)
      if (searchQuery) params.append('search', searchQuery)

      const response = await fetch(`/api/lab-ia/pipelines/history?${params.toString()}`, {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        console.error('[PIPELINE-HISTORY] Erro na API:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
        })
        throw new Error(errorData.error || errorData.details || `Erro ao carregar histórico (${response.status})`)
      }

      const data = await response.json()
      setExecutions(data.logs || [])
      setTotalPages(data.pagination?.pages || 1)
    } catch (error: any) {
      console.error('Erro ao carregar execuções:', error)
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível carregar o histórico',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetails = (execution: Execution) => {
    setSelectedExecution(execution)
    setIsModalOpen(true)
  }

  const handleClearFilters = () => {
    setSelectedPipeline('')
    setSelectedUser('')
    setStartDate('')
    setEndDate('')
    setSearchQuery('')
    setPage(1)
  }

  const hasActiveFilters = selectedPipeline || selectedUser || startDate || endDate || searchQuery

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-red-600">Acesso Negado</CardTitle>
            <CardDescription>
              Você precisa estar logado para acessar o histórico de pipelines
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
            <History className="h-8 w-8" />
            Histórico de Execuções
          </h1>
          <p className="text-muted-foreground mt-1">
            Visualize e analise execuções passadas de pipelines
          </p>
        </div>
        <Link href="/ai-lab">
          <Button variant="outline">Voltar ao Laboratório</Button>
        </Link>
      </div>

      {/* Filtros */}
      <Card className="mb-6">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="h-5 w-5" />
              Filtros
            </CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Busca */}
            <div className="lg:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por palavra-chave..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Pipeline */}
            <Select 
              value={selectedPipeline || undefined} 
              onValueChange={(value) => setSelectedPipeline(value || '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todos os Pipelines" />
              </SelectTrigger>
              <SelectContent>
                {pipelines.map((pipeline) => (
                  <SelectItem key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Usuário (apenas admin) */}
            {isAdmin && (
              <Select 
                value={selectedUser || undefined} 
                onValueChange={(value) => setSelectedUser(value || '')}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os Usuários" />
                </SelectTrigger>
                <SelectContent>
                  {users.map((userItem) => (
                    <SelectItem key={userItem.id} value={userItem.id}>
                      {userItem.full_name || userItem.email || 'Usuário Desconhecido'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Datas */}
            <div className="flex gap-2">
              <Input
                type="date"
                placeholder="Data Inicial"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="flex-1"
              />
              <Input
                type="date"
                placeholder="Data Final"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="flex-1"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Listagem */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">Carregando histórico...</p>
        </div>
      ) : executions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <History className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhuma execução encontrada</p>
            <Link href="/ai-lab">
              <Button variant="outline" className="mt-4">
                Voltar ao Laboratório
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {executions.map((execution) => (
              <PipelineExecutionCard
                key={execution.id}
                execution={execution}
                onViewDetails={handleViewDetails}
                showUser={isAdmin}
              />
            ))}
          </div>

          {/* Paginação */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-muted-foreground">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                Próxima
              </Button>
            </div>
          )}
        </>
      )}

      {/* Modal de detalhes */}
      {selectedExecution && (
        <PipelineExecutionModal
          execution={selectedExecution}
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
        />
      )}
    </div>
  )
}

