'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  BookOpen,
  User,
  Settings,
  LogOut,
  Menu,
  Search,
  Shield,
  LogIn,
  BarChart3,
  FileText,
  Plus,
  Sparkles,
  ClipboardList,
  Trophy,
  Award,
  CreditCard,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/contexts/AuthContext'
import { SimpleThemeToggle } from '@/components/theme-toggle'
import { Notifications } from '@/components/notifications'
import { useGamification } from '@/hooks/useGamification'
import { PointsDisplay, LevelBadge, StreakDisplay } from '@/components/gamification'

export default function Header() {
  const { user, loading: authLoading, signOut, isAdmin } = useAuth()
  const { stats } = useGamification()
  const { toast } = useToast()

  const handleManageSubscription = async () => {
    try {
      toast({ title: 'Redirecionando...', description: 'Aguarde enquanto levamos você ao portal do cliente.' })
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })
      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        toast({ title: 'Erro', description: data.error || 'Erro ao abrir portal', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Erro', description: 'Erro de conexão', variant: 'destructive' })
    }
  }

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 flex h-16 items-center justify-between">
        {/* Logo */}
        <div className="flex items-center space-x-4">
          <Link href="/" className="flex items-center space-x-2">
            <BookOpen className="h-6 w-6 text-primary" />
            <div className="flex flex-col">
              <span className="text-xl font-bold">WE Academy</span>
              <span className="text-xs text-muted-foreground -mt-1">by WE Marketing Médico</span>
            </div>
          </Link>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <Link href="/courses" className="text-sm font-medium hover:text-primary transition-colors">
            Cursos
          </Link>
          <Link href="/ai-lab" className="text-sm font-medium hover:text-primary transition-colors flex items-center space-x-1">
            <Sparkles className="h-4 w-4" />
            <span>Laboratório de IA</span>
          </Link>
          {/* Mostrar link Admin apenas para admins */}
          {isAdmin && (
            <Link href="/admin" className="text-sm font-medium hover:text-primary transition-colors flex items-center space-x-1">
              <Shield className="h-4 w-4" />
              <span>Admin</span>
            </Link>
          )}
        </nav>

        {/* Search Bar */}
        <div className="hidden md:flex items-center space-x-2 flex-1 max-w-md mx-8">
          <div className="relative w-full max-w-xl">
            <Input
              type="search"
              placeholder="Buscar cursos..."
              className="h-10 w-full"
            />
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <SimpleThemeToggle />


          {authLoading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
          ) : user ? (
            <>
              {/* Gamification Indicators */}
              {stats && (
                <div className="hidden lg:flex items-center gap-3 px-3 py-1.5 rounded-lg border bg-muted/50">
                  <Link href="/profile/dashboard" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                    <PointsDisplay
                      points={stats.total_xp}
                      showIcon
                      size="sm"
                      variant="compact"
                    />
                    <LevelBadge
                      level={stats.current_level}
                      size="sm"
                      showIcon
                    />
                    <StreakDisplay
                      currentStreak={stats.current_streak}
                      size="sm"
                      variant="compact"
                    />
                  </Link>
                </div>
              )}

              {/* Notifications */}
              <Notifications />

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:opacity-80 transition-opacity">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarImage src={user.avatar_url || undefined} alt={user.full_name || "Usuário"} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email?.charAt(0).toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{user.full_name || "Usuário"}</p>
                      <p className="text-xs leading-none text-muted-foreground">
                        {user.email}
                      </p>
                      <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="w-fit">
                        {user.role === 'admin' ? 'Administrador' : user.role === 'user' ? 'Usuário' : 'Convidado'}
                      </Badge>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/my-courses" className="flex items-center">
                      <BookOpen className="mr-2 h-4 w-4" />
                      <span>Meus Cursos</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center">
                      <User className="mr-2 h-4 w-4" />
                      <span>Perfil & Configurações</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/dashboard" className="flex items-center">
                      <Trophy className="mr-2 h-4 w-4" />
                      <span>Meu Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile/badges" className="flex items-center">
                      <Award className="mr-2 h-4 w-4" />
                      <span>Meus Badges</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/leaderboard" className="flex items-center">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      <span>Ranking</span>
                    </Link>
                  </DropdownMenuItem>
                  {/* Seção Admin */}
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                        Administração
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center">
                          <Shield className="mr-2 h-4 w-4" />
                          <span>Dashboard Admin</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/courses" className="flex items-center">
                          <BookOpen className="mr-2 h-4 w-4" />
                          <span>Cursos</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/analytics" className="flex items-center">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          <span>Analytics</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/admin/audit-logs" className="flex items-center">
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Audit Logs</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground">
                        Laboratório de IA
                      </DropdownMenuLabel>
                      <DropdownMenuItem asChild>
                        <Link href="/ai-lab/admin" className="flex items-center">
                          <BarChart3 className="mr-2 h-4 w-4" />
                          <span>Dashboard</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/ai-lab/admin/agents" className="flex items-center">
                          <Sparkles className="mr-2 h-4 w-4" />
                          <span>Gerenciar Agentes</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/ai-lab/admin/agents/templates" className="flex items-center">
                          <FileText className="mr-2 h-4 w-4" />
                          <span>Templates de Agentes</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/ai-lab/admin/pipelines" className="flex items-center">
                          <Sparkles className="mr-2 h-4 w-4" />
                          <span>Pipelines</span>
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/ai-lab/admin/workflows/human-tasks" className="flex items-center">
                          <ClipboardList className="mr-2 h-4 w-4" />
                          <span>Tarefas Humanas</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleManageSubscription}>
                    <CreditCard className="mr-2 h-4 w-4" />
                    <span>Gerenciar Assinatura</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut}>
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sair</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            /* Botões de login para usuários não autenticados */
            <div className="flex items-center space-x-2">
              <Button variant="ghost" asChild>
                <Link href="/auth/login">
                  <LogIn className="mr-2 h-4 w-4" />
                  Entrar
                </Link>
              </Button>
              <Button asChild>
                <Link href="/auth/register">
                  Cadastrar
                </Link>
              </Button>
            </div>
          )}

          {/* Mobile Menu */}
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </header>
  )
}
