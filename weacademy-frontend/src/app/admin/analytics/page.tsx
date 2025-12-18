'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts'
import {
  TrendingUp,
  Users,
  DollarSign,
  CreditCard,
  Target,
  AlertTriangle,
  Loader2,
  BrainCircuit
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'

interface AnalyticsData {
  mrr: number
  totalUsers: number
  activeSubscribers: number
  churnRate: number
  revenueChart: { date: string; amount: number }[]
  aiUsageChart: { name: string; value: number }[]
}

export default function AnalyticsPage() {
  const { user, isAdmin } = useAuth()
  const { toast } = useToast()

  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d']

  useEffect(() => {
    if (isAdmin) {
      fetchAnalytics()
    }
  }, [isAdmin])

  const fetchAnalytics = async () => {
    try {
      const res = await fetch('/api/admin/analytics/dashboard')
      if (!res.ok) throw new Error('Falha ao carregar dados')
      const json = await res.json()
      setData(json)
    } catch (error) {
      console.error(error)
      toast({
        title: 'Erro',
        description: 'Não foi possível carregar o dashboard.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="container mx-auto space-y-8">

        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold flex items-center space-x-3">
            <Target className="h-8 w-8 text-primary" />
            <span>Visão Estratégica</span>
          </h1>
          <p className="text-muted-foreground mt-2">
            Acompanhe a saúde financeira e operacional da WeAcademy.
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>MRR (Recorrente)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center space-x-2 text-green-600">
                <DollarSign className="h-6 w-6" />
                <span>
                  {data?.mrr.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Previsão mensal atual</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Assinantes Ativos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center space-x-2 text-blue-600">
                <CreditCard className="h-6 w-6" />
                <span>{data?.activeSubscribers}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Pagantes recorrentes</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Base de Usuários</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold flex items-center space-x-2">
                <Users className="h-6 w-6" />
                <span>{data?.totalUsers}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Cadastros totais (inclui grátis)
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Churn Rate</CardDescription>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold flex items-center space-x-2 ${(data?.churnRate || 0) > 5 ? 'text-red-600' : 'text-green-600'
                }`}>
                <AlertTriangle className="h-6 w-6" />
                <span>{data?.churnRate.toFixed(1)}%</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Cancelamentos sobre total ativo</p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Revenue Chart */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span>Histórico de Faturamento</span>
              </CardTitle>
              <CardDescription>Receita realizada nos últimos 6 meses</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data?.revenueChart}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(val) => {
                      const [y, m] = val.split('-')
                      return `${m}/${y.slice(2)}`
                    }}
                    tick={{ fontSize: 12 }}
                  />
                  <YAxis
                    tickFormatter={(val) => `R$${val}`}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`R$ ${value.toFixed(2)}`, 'Receita']}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Bar dataKey="amount" fill="#16a34a" radius={[4, 4, 0, 0]} name="Receita" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* AI Usage Chart */}
          <Card className="col-span-1">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <BrainCircuit className="h-5 w-5 text-purple-600" />
                <span>Consumo de IA por Modelo</span>
              </CardTitle>
              <CardDescription>Distribuição de uso dos modelos de inteligência</CardDescription>
            </CardHeader>
            <CardContent className="h-[300px]">
              {(!data?.aiUsageChart || data.aiUsageChart.length === 0) ? (
                <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                  Nenhum uso de IA registrado ainda.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data?.aiUsageChart}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      innerRadius={60}
                      paddingAngle={5}
                      label={({ name, percent }: any) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                    >
                      {data?.aiUsageChart.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

        </div>
      </div>
    </div>
  )
}
