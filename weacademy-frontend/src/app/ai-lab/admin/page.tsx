'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'
import { FileText } from 'lucide-react'

type DashboardStats = {
  totalMessages: number
  totalConversations: number
  totalAgentsExecuted: number
  totalTokens: number
  totalCost: number
  costByProvider: {
    provider: string
    cost: number
  }[]
  costByModel: {
    provider: string
    model: string
    totalCost: number
    percentage: number
    executions: number
    avgCost: number
  }[]
  topAgents: {
    agent_id: string
    count: number
  }[]
  averageLatency: number
  costByUser: {
    userId: string
    email: string
    totalCost: number
    percentage: number
    executions: number
    modelsUsed: {
      provider: string
      model: string
      cost: number
      executions: number
    }[]
  }[]
}

const COLORS = ['#29CEDF', '#25D366', '#FFD700', '#FF6B6B', '#4ECDC4']

export default function LabAdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDashboardStats()
  }, [])

  const fetchDashboardStats = async () => {
    try {
      // Obter token de autenticação
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/dashboard', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Failed to fetch dashboard stats')
      }

      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      // Obter token de autenticação
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/export', {
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Failed to export report')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `lab-ia-relatorio-${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      console.error('Export error:', err)
      alert(err instanceof Error ? err.message : 'Erro ao exportar relatório')
    }
  }

  const handleCheckCosts = async () => {
    try {
      // Obter token de autenticação
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      const response = await fetch('/api/lab-ia/admin/check-costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` })
        },
        credentials: 'include',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Failed to check costs')
      }

      const data = await response.json()
      alert(`${data.alertsGenerated} alertas gerados`)
    } catch (err) {
      console.error('Check costs error:', err)
      alert(err instanceof Error ? err.message : 'Erro ao verificar custos')
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando estatísticas...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-4">Erro</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!stats) {
    return null
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Dashboard - Laboratório de IA</h1>
            <p className="text-muted-foreground mt-1">
              Visão geral de uso, custos e métricas
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/ai-lab/admin/test-reports">
              <Button variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Relatórios de Teste
              </Button>
            </Link>
            <Button onClick={handleCheckCosts} variant="outline">
              Verificar Custos
            </Button>
            <Button onClick={handleExport}>
              Exportar Relatório
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total de Mensagens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalMessages}</div>
              <p className="text-xs text-muted-foreground">
                Conversas iniciadas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Conversas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalConversations}</div>
              <p className="text-xs text-muted-foreground">
                Sessões ativas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Agentes Executados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalAgentsExecuted}</div>
              <p className="text-xs text-muted-foreground">
                Execuções totais
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Custo Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">${stats.totalCost.toFixed(4)}</div>
              <p className="text-xs text-muted-foreground">
                Custo acumulado
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Cost by Provider */}
          <Card>
            <CardHeader>
              <CardTitle>Custo por Provedor</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.costByProvider}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }: any) => `${name}: $${value.toFixed(2)}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="cost"
                  >
                    {stats.costByProvider.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Agents */}
          <Card>
            <CardHeader>
              <CardTitle>Agentes Mais Usados</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={stats.topAgents}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="agent_id" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#29CEDF" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Cost by Model Section */}
        {stats.costByModel && stats.costByModel.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2">
            {/* Top Models Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Top 10 Modelos Mais Custosos</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={stats.costByModel.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="model"
                      type="category"
                      width={90}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => `$${value.toFixed(4)}`}
                      labelFormatter={(label) => `Modelo: ${label}`}
                    />
                    <Bar dataKey="totalCost" fill="#29CEDF" radius={[0, 4, 4, 0]}>
                      {stats.costByModel.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Cost by Model Table */}
            <Card>
              <CardHeader>
                <CardTitle>Custo por Modelo</CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  Detalhamento completo de custos por modelo ativo
                </p>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Modelo</TableHead>
                        <TableHead className="text-right">Custo Total</TableHead>
                        <TableHead className="text-right">%</TableHead>
                        <TableHead className="text-right">Execuções</TableHead>
                        <TableHead className="text-right">Custo Médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {stats.costByModel.slice(0, 10).map((item, index) => (
                        <TableRow key={`${item.provider}-${item.model}-${index}`}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{item.model}</span>
                              <span className="text-xs text-muted-foreground">{item.provider}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            ${item.totalCost.toFixed(4)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-muted rounded-full h-2">
                                <div
                                  className="bg-primary h-2 rounded-full"
                                  style={{ width: `${Math.min(item.percentage, 100)}%` }}
                                />
                              </div>
                              <span className="text-sm text-muted-foreground w-12 text-right">
                                {item.percentage.toFixed(1)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {item.executions.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            ${item.avgCost.toFixed(4)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {stats.costByModel.length > 10 && (
                  <p className="text-xs text-muted-foreground mt-4 text-center">
                    Mostrando top 10 de {stats.costByModel.length} modelos
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Cost by User Section */}
        {stats.costByUser && stats.costByUser.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Consumo por Usuário</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Detalhamento de custos, execuções e modelos utilizados por cada usuário
              </p>
            </CardHeader>
            <CardContent>
              {/* Top Users Chart */}
              <div className="mb-6">
                <h3 className="text-lg font-semibold mb-4">Top 10 Usuários por Custo</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart
                    data={stats.costByUser.slice(0, 10)}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis
                      dataKey="email"
                      type="category"
                      width={140}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip
                      formatter={(value: number) => `$${value.toFixed(4)}`}
                      labelFormatter={(label) => `Usuário: ${label}`}
                    />
                    <Bar dataKey="totalCost" fill="#29CEDF" radius={[0, 4, 4, 0]}>
                      {stats.costByUser.slice(0, 10).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Users Table */}
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead className="text-right">Custo Total</TableHead>
                      <TableHead className="text-right">%</TableHead>
                      <TableHead className="text-right">Execuções</TableHead>
                      <TableHead>Modelos Mais Usados</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.costByUser.map((user, index) => (
                      <TableRow key={user.userId}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="font-medium">{user.email}</span>
                            <span className="text-xs text-muted-foreground">ID: {user.userId.slice(0, 8)}...</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${user.totalCost.toFixed(4)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 bg-muted rounded-full h-2">
                              <div
                                className="bg-primary h-2 rounded-full"
                                style={{ width: `${Math.min(user.percentage, 100)}%` }}
                              />
                            </div>
                            <span className="text-sm text-muted-foreground w-12 text-right">
                              {user.percentage.toFixed(1)}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {user.executions.toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {user.modelsUsed.slice(0, 3).map((model, modelIndex) => (
                              <div key={modelIndex} className="text-sm">
                                <span className="font-medium">{model.model}</span>
                                <span className="text-muted-foreground ml-2">
                                  ({model.provider}) - ${model.cost.toFixed(4)} ({model.executions} exec)
                                </span>
                              </div>
                            ))}
                            {user.modelsUsed.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{user.modelsUsed.length - 3} modelo(s) adicional(is)
                              </span>
                            )}
                            {user.modelsUsed.length === 0 && (
                              <span className="text-xs text-muted-foreground">Nenhum modelo registrado</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {stats.costByUser.length > 10 && (
                <p className="text-xs text-muted-foreground mt-4 text-center">
                  Mostrando todos os {stats.costByUser.length} usuários
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Additional Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Métricas Adicionais</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Latência Média
                </p>
                <p className="text-2xl font-bold">{stats.averageLatency}ms</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Total de Tokens
                </p>
                <p className="text-2xl font-bold">
                  {stats.totalTokens.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
