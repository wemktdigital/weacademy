'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Bell,
  Send,
  Users,
  User,
  Search,
  RefreshCw,
  Check,
  X,
  AlertCircle,
  Info,
  TrendingUp,
  Award,
  Trophy,
} from 'lucide-react'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import { getAllUsers } from '@/lib/auth'
import { Checkbox } from '@/components/ui/checkbox'

interface User {
  id: string
  email: string
  full_name: string | null
  role: string
}

interface Notification {
  id: string
  title: string
  message: string
  type: string
  read: boolean
  created_at: string
  user: {
    id: string
    email: string
    full_name: string | null
  }
}

type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'achievement' | 'level_up' | 'streak' | 'leaderboard'

export default function AdminNotificationsPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  
  // Form state
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<NotificationType>('info')
  const [recipientType, setRecipientType] = useState<'all' | 'selected'>('selected')
  const [selectedUsers, setSelectedUsers] = useState<string[]>([])
  const [searchUser, setSearchUser] = useState('')
  
  // Data state
  const [users, setUsers] = useState<User[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingNotifications, setLoadingNotifications] = useState(true)

  useEffect(() => {
    if (!user || !isAdmin) {
      router.push('/access-denied')
      return
    }

    loadUsers()
    loadNotifications()
  }, [user, isAdmin, router])

  const loadUsers = async () => {
    try {
      setLoadingUsers(true)
      const { data, error } = await getAllUsers()
      if (error) throw error
      setUsers(data || [])
    } catch (error: any) {
      console.error('Erro ao carregar usuários:', error)
      toast.error('Erro ao carregar usuários')
    } finally {
      setLoadingUsers(false)
    }
  }

  const loadNotifications = async () => {
    try {
      setLoadingNotifications(true)
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/admin/notifications?limit=50', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) {
        throw new Error('Erro ao carregar notificações')
      }

      const result = await response.json()
      setNotifications(result.notifications || [])
    } catch (error: any) {
      console.error('Erro ao carregar notificações:', error)
      toast.error('Erro ao carregar notificações')
    } finally {
      setLoadingNotifications(false)
    }
  }

  const handleSendNotification = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Título e mensagem são obrigatórios')
      return
    }

    if (recipientType === 'selected' && selectedUsers.length === 0) {
      toast.error('Selecione pelo menos um usuário')
      return
    }

    setSending(true)
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_ids: recipientType === 'all' ? 'all' : selectedUsers,
          title: title.trim(),
          message: message.trim(),
          type,
          metadata: {},
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao enviar notificação')
      }

      const result = await response.json()
      
      toast.success(`Notificação enviada para ${result.count} usuário(s)!`)
      
      // Reset form
      setTitle('')
      setMessage('')
      setType('info')
      setSelectedUsers([])
      setRecipientType('selected')
      
      // Reload notifications
      loadNotifications()
    } catch (error: any) {
      console.error('Erro ao enviar notificação:', error)
      toast.error(error.message || 'Erro ao enviar notificação')
    } finally {
      setSending(false)
    }
  }

  const toggleUserSelection = (userId: string) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    )
  }

  const selectAllUsers = () => {
    if (selectedUsers.length === filteredUsers.length) {
      setSelectedUsers([])
    } else {
      setSelectedUsers(filteredUsers.map(u => u.id))
    }
  }

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchUser.toLowerCase()) ||
    (u.full_name && u.full_name.toLowerCase().includes(searchUser.toLowerCase()))
  )

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <Check className="h-4 w-4 text-green-500" />
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />
      case 'error':
        return <X className="h-4 w-4 text-red-500" />
      case 'achievement':
      case 'level_up':
        return <Trophy className="h-4 w-4 text-blue-500" />
      case 'streak':
      case 'leaderboard':
        return <TrendingUp className="h-4 w-4 text-orange-500" />
      default:
        return <Info className="h-4 w-4 text-blue-500" />
    }
  }

  const getTypeBadgeVariant = (type: string) => {
    switch (type) {
      case 'success':
        return 'default'
      case 'warning':
        return 'secondary'
      case 'error':
        return 'destructive'
      default:
        return 'outline'
    }
  }

  if (!isAdmin) {
    return null
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center space-x-2">
                <Bell className="h-8 w-8 text-primary" />
                <span>Gerenciar Notificações</span>
              </h1>
              <p className="text-muted-foreground mt-1">
                Envie notificações para usuários da plataforma
              </p>
            </div>
            <Button onClick={loadNotifications} disabled={loadingNotifications} variant="outline">
              <RefreshCw className={`mr-2 h-4 w-4 ${loadingNotifications ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>

      <div className="container py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form Card */}
          <Card>
            <CardHeader>
              <CardTitle>Enviar Nova Notificação</CardTitle>
              <CardDescription>
                Crie e envie notificações para usuários individuais ou todos os usuários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Bem-vindo à WE Academy!"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={200}
                />
              </div>

              {/* Message */}
              <div className="space-y-2">
                <Label htmlFor="message">Mensagem *</Label>
                <Textarea
                  id="message"
                  placeholder="Ex: Explore nossos cursos e comece sua jornada de aprendizado."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground">
                  {message.length}/1000 caracteres
                </p>
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label htmlFor="type">Tipo</Label>
                <Select value={type} onValueChange={(value) => setType(value as NotificationType)}>
                  <SelectTrigger id="type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">
                      <div className="flex items-center space-x-2">
                        <Info className="h-4 w-4 text-blue-500" />
                        <span>Informação</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="success">
                      <div className="flex items-center space-x-2">
                        <Check className="h-4 w-4 text-green-500" />
                        <span>Sucesso</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="warning">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="h-4 w-4 text-yellow-500" />
                        <span>Aviso</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="error">
                      <div className="flex items-center space-x-2">
                        <X className="h-4 w-4 text-red-500" />
                        <span>Erro</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="achievement">
                      <div className="flex items-center space-x-2">
                        <Award className="h-4 w-4 text-purple-500" />
                        <span>Conquista</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="level_up">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-blue-500" />
                        <span>Subiu de Nível</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="streak">
                      <div className="flex items-center space-x-2">
                        <TrendingUp className="h-4 w-4 text-orange-500" />
                        <span>Sequência</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="leaderboard">
                      <div className="flex items-center space-x-2">
                        <Trophy className="h-4 w-4 text-yellow-500" />
                        <span>Ranking</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Recipient Type */}
              <div className="space-y-2">
                <Label>Destinatários</Label>
                <Select
                  value={recipientType}
                  onValueChange={(value) => {
                    setRecipientType(value as 'all' | 'selected')
                    if (value === 'all') {
                      setSelectedUsers([])
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center space-x-2">
                        <Users className="h-4 w-4" />
                        <span>Todos os usuários</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="selected">
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4" />
                        <span>Usuários selecionados ({selectedUsers.length})</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* User Selection */}
              {recipientType === 'selected' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Selecionar Usuários</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={selectAllUsers}
                    >
                      {selectedUsers.length === filteredUsers.length ? 'Desmarcar todos' : 'Selecionar todos'}
                    </Button>
                  </div>
                  
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por email ou nome..."
                      value={searchUser}
                      onChange={(e) => setSearchUser(e.target.value)}
                      className="pl-10"
                    />
                  </div>

                  <div className="border rounded-lg max-h-60 overflow-y-auto">
                    {loadingUsers ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Carregando usuários...
                      </div>
                    ) : filteredUsers.length === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        Nenhum usuário encontrado
                      </div>
                    ) : (
                      <div className="divide-y">
                        {filteredUsers.map((u) => (
                          <div
                            key={u.id}
                            className="flex items-center space-x-2 p-3 hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleUserSelection(u.id)}
                          >
                            <Checkbox
                              checked={selectedUsers.includes(u.id)}
                              onCheckedChange={() => toggleUserSelection(u.id)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">
                                {u.full_name || u.email}
                              </div>
                              {u.full_name && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {u.email}
                                </div>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {u.role}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Send Button */}
              <Button
                onClick={handleSendNotification}
                disabled={sending || !title.trim() || !message.trim() || (recipientType === 'selected' && selectedUsers.length === 0)}
                className="w-full"
                size="lg"
              >
                <Send className="mr-2 h-4 w-4" />
                {sending ? 'Enviando...' : 'Enviar Notificação'}
              </Button>

              {recipientType === 'all' && (
                <p className="text-sm text-muted-foreground text-center">
                  A notificação será enviada para todos os {users.length} usuários cadastrados
                </p>
              )}
            </CardContent>
          </Card>

          {/* Notifications List */}
          <Card>
            <CardHeader>
              <CardTitle>Notificações Recentes</CardTitle>
              <CardDescription>
                Últimas notificações enviadas
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingNotifications ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma notificação enviada ainda</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-2 flex-1">
                          {getTypeIcon(notification.type)}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2">
                              <h4 className="font-semibold">{notification.title}</h4>
                              <Badge variant={getTypeBadgeVariant(notification.type)}>
                                {notification.type}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                              <span>
                                {notification.user?.full_name || notification.user?.email || 'Usuário desconhecido'}
                              </span>
                              <span>•</span>
                              <span>
                                {new Date(notification.created_at).toLocaleString('pt-BR')}
                              </span>
                              {notification.read && (
                                <>
                                  <span>•</span>
                                  <span className="text-green-500">Lida</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

