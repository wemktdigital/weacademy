'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Bell, Check, CheckCheck, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'

interface Notification {
  id: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'achievement' | 'level_up' | 'streak' | 'leaderboard'
  read: boolean
  created_at: string
  metadata?: Record<string, any>
}

export function Notifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [markingRead, setMarkingRead] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Carregar notificações
  const fetchNotifications = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (error) {
        // Se a tabela não existir ou houver erro de permissão, não quebrar a UI
        // Não logar erro completo se for apenas ausência de permissão ou tabela
        if (error.code !== 'PGRST116' && error.message && !error.message.includes('permission denied')) {
          console.warn('Erro ao carregar notificações:', error)
        }
        setNotifications([])
        setUnreadCount(0)
        return
      }

      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read).length || 0)
    } catch (error: any) {
      console.error('Erro ao carregar notificações:', error)
      // Não quebrar a UI se houver erro
      setNotifications([])
      setUnreadCount(0)
    } finally {
      setLoading(false)
    }
  }

  // Marcar notificação como lida
  const markAsRead = async (notificationId: string) => {
    setMarkingRead(notificationId)
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId)

      if (error) throw error

      // Atualizar estado local com animação
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId
            ? { ...n, read: true }
            : n
        )
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (error) {
      console.error('Erro ao marcar como lida:', error)
    } finally {
      setMarkingRead(null)
    }
  }

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    if (!user) return

    setLoading(true)
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)

      if (error) throw error

      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      )
      setUnreadCount(0)
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error)
    } finally {
      setLoading(false)
    }
  }

  // Carregar notificações ao montar e quando usuário mudar
  useEffect(() => {
    if (!user) return

    // Carregar imediatamente
    fetchNotifications()

    // Polling: atualizar notificações a cada 30 segundos
    const interval = setInterval(() => {
      fetchNotifications()
    }, 30000)

    // Escutar mudanças em tempo real usando Supabase Realtime
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Atualizar notificações quando houver mudanças
          fetchNotifications()
        }
      )
      .subscribe()

    return () => {
      clearInterval(interval)
      supabase.removeChannel(channel)
    }
  }, [user])

  if (!user) {
    return null
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs flex items-center justify-center animate-in zoom-in duration-200"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notificações</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[380px] p-0"
        ref={containerRef}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAllAsRead}
              disabled={loading}
              className="h-8"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <>
                  <CheckCheck className="mr-1 h-3 w-3" />
                  Marcar todas
                </>
              )}
            </Button>
          )}
        </div>

        {/* Notifications List */}
        <div className="max-h-[400px] overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4">
              <Bell className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center">
                Nenhuma notificação ainda
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={() => markAsRead(notification.id)}
                  isMarkingRead={markingRead === notification.id}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button variant="ghost" className="w-full justify-center text-xs">
              Ver todas as notificações
            </Button>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

interface NotificationItemProps {
  notification: Notification
  onMarkAsRead: () => void
  isMarkingRead: boolean
}

function NotificationItem({ notification, onMarkAsRead, isMarkingRead }: NotificationItemProps) {
  const [fading, setFading] = useState(false)

  const handleClick = () => {
    if (!notification.read) {
      setFading(true)
      setTimeout(() => {
        onMarkAsRead()
        setFading(false)
      }, 300)
    }
  }

  const getTypeStyles = () => {
    switch (notification.type) {
      case 'success':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20'
      case 'warning':
        return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-950/20'
      case 'error':
        return 'border-l-red-500 bg-red-50 dark:bg-red-950/20'
      case 'achievement':
      case 'level_up':
        return 'border-l-green-500 bg-green-50 dark:bg-green-950/20'
      case 'streak':
      case 'leaderboard':
        return 'border-l-orange-500 bg-orange-50 dark:bg-orange-950/20'
      default:
        return 'border-l-blue-500 bg-blue-50 dark:bg-blue-950/20'
    }
  }

  const formatTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (minutes < 1) return 'Agora'
    if (minutes < 60) return `${minutes}m atrás`
    if (hours < 24) return `${hours}h atrás`
    if (days < 7) return `${days}d atrás`
    return date.toLocaleDateString('pt-BR')
  }

  return (
    <div
      className={`
        group relative transition-all duration-300 ease-in-out
        ${fading ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'}
        ${!notification.read ? 'bg-muted/50' : ''}
        hover:bg-muted
      `}
    >
      {/* Left border indicator */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 ${notification.read ? 'bg-transparent' : getTypeStyles().split(' ')[0]
          }`}
      />

      {/* Content */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        className={`w-full text-left p-4 pr-12 relative cursor-pointer ${isMarkingRead ? 'pointer-events-none opacity-50' : ''}`}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            handleClick()
          }
        }}
      >
        <div className="flex items-start space-x-3">
          <div className={`flex-1 min-w-0 ${notification.read ? 'opacity-60' : ''}`}>
            <p className="text-sm font-medium truncate">{notification.title}</p>
            <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
              {notification.message}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              {formatTime(notification.created_at)}
            </p>
          </div>

          {/* Mark as read button */}
          {!notification.read && !fading && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleClick()
              }}
              className="absolute right-2 top-4 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              {isMarkingRead ? (
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              ) : (
                <Check className="h-4 w-4 text-muted-foreground hover:text-primary transition-colors" />
              )}
            </button>
          )}

          {/* Read indicator */}
          {notification.read && (
            <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
          )}
        </div>

        {/* Unread indicator */}
        {!notification.read && (
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-2 h-2 bg-primary rounded-full animate-pulse" />
        )}
      </div>
    </div>
  )
}
