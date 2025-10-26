'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
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
  topAgents: {
    agent_id: string
    count: number
  }[]
  averageLatency: number
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
      const response = await fetch('/api/lab-ia/admin/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats')
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
      const response = await fetch('/api/lab-ia/admin/export')
      if (!response.ok) {
        throw new Error('Failed to export report')
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
      alert('Erro ao exportar relatório')
    }
  }

  const handleCheckCosts = async () => {
    try {
      const response = await fetch('/api/lab-ia/admin/check-costs', {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to check costs')
      }
      const data = await response.json()
      alert(`${data.alertsGenerated} alertas gerados`)
    } catch (err) {
      console.error('Check costs error:', err)
      alert('Erro ao verificar custos')
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
                    label={({ provider, cost }) => `${provider}: $${cost.toFixed(2)}`}
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
