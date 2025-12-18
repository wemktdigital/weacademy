'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Shield,
  Users,
  UserCheck,
  UserX,
  Search,
  RefreshCw,
  Settings,
  Activity,
  AlertCircle,
  BarChart3,
  FileText,
  Bell,
  CreditCard,
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { getAllUsers, updateUserRole, getAdminLogs, UserRole } from '@/lib/auth'
import Link from 'next/link'

interface User {
  id: string
  email: string
  full_name: string | null
  role: UserRole
  created_at: string
  updated_at: string
}

interface AdminLog {
  id: string
  action: string
  details: any
  created_at: string
  admin: User
  target_user: User | null
}

export default function AdminDashboard() {
  const { user, loading: authLoading, isAdmin } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [logs, setLogs] = useState<AdminLog[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedRole, setSelectedRole] = useState<string>('all')

  useEffect(() => {
    if (isAdmin) {
      loadData()
    }
  }, [isAdmin])

  const loadData = async () => {
    try {
      const [usersResult, logsResult] = await Promise.all([
        getAllUsers(),
        getAdminLogs()
      ])

      if (usersResult.data) setUsers(usersResult.data)
      if (logsResult.data) setLogs(logsResult.data)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    try {
      const { error } = await updateUserRole(userId, newRole)
      if (error) {
        alert('Erro ao atualizar role: ' + error.message)
      } else {
        // Atualizar lista local
        setUsers(users.map(u => u.id === userId ? { ...u, role: newRole } : u))
        // Recarregar logs
        const logsResult = await getAdminLogs()
        if (logsResult.data) setLogs(logsResult.data)
      }
    } catch (error) {
      console.error('Erro ao atualizar role:', error)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    const matchesRole = selectedRole === 'all' || user.role === selectedRole
    return matchesSearch && matchesRole
  })

  const getRoleBadgeVariant = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'default'
      case 'user': return 'secondary'
      case 'guest': return 'outline'
      default: return 'outline'
    }
  }

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrador'
      case 'user': return 'Usuário'
      case 'guest': return 'Convidado'
      default: return role
    }
  }

  // Mostrar loading enquanto verifica permissões
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Carregando...</p>
      </div>
    )
  }

  if (!isAdmin) {
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
            <p>Você não tem permissão para acessar esta página.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-2">
                <Shield className="h-8 w-8 text-primary" />
                <span>Painel Administrativo</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Gerencie usuários e monitore atividades do sistema
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <Button asChild variant="default" className="bg-primary text-white hover:bg-primary/90 shadow-md">
                <Link href="/admin/notifications" className="flex items-center">
                  <span className="mr-2">🔔</span>
                  <span>Notificações</span>
                </Link>
              </Button>
              <Button onClick={loadData} disabled={loading} variant="outline">
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Atualizar
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">
                {users.filter(u => u.role === 'user').length} usuários ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Administradores</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.filter(u => u.role === 'admin').length}</div>
              <p className="text-xs text-muted-foreground">
                Usuários com privilégios administrativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Atividades Recentes</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logs.length}</div>
              <p className="text-xs text-muted-foreground">
                Ações administrativas registradas
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Access */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Link href="/admin/analytics">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Analytics</h3>
                    <p className="text-sm text-muted-foreground">Ver métricas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/audit-logs">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Audit Logs</h3>
                    <p className="text-sm text-muted-foreground">Ver logs</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/notifications">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <Bell className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Notificações</h3>
                    <p className="text-sm text-muted-foreground">Enviar notificações</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/admin/plans">
            <Card className="cursor-pointer hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-center space-x-4">
                  <div className="p-3 rounded-lg bg-primary/10">
                    <CreditCard className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold">Planos</h3>
                    <p className="text-sm text-muted-foreground">Gerenciar assinaturas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* User Management */}
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Gerenciamento de Usuários</CardTitle>
              <CardDescription>
                Acesse o painel completo para criar, editar e remover usuários.
              </CardDescription>
            </div>
            <Button asChild>
              <Link href="/admin/users">
                Gerenciar Usuários
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/20">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-primary/10 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Controle Total</h3>
                  <p className="text-sm text-muted-foreground">
                    Adicione novos administradores, edite perfis ou remova contas.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Logs */}
        <Card>
          <CardHeader>
            <CardTitle>Log de Atividades Administrativas</CardTitle>
            <CardDescription>
              Histórico de ações realizadas pelos administradores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {logs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center space-x-4 p-4 border rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Settings className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium">{log.admin.full_name || log.admin.email}</span>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(log.created_at).toLocaleString('pt-BR')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {log.action === 'role_updated' && log.target_user && (
                        <>
                          Alterou o role de <strong>{log.target_user.email}</strong> de{' '}
                          <Badge variant="outline" className="text-xs">
                            {getRoleLabel(log.details?.old_role)}
                          </Badge>{' '}
                          para{' '}
                          <Badge variant="outline" className="text-xs">
                            {getRoleLabel(log.details?.new_role)}
                          </Badge>
                        </>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
