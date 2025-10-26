'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
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
  Heart,
  ShoppingCart,
  Shield,
  LogIn,
  BarChart3,
  FileText,
  Plus,
  Sparkles
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { SimpleThemeToggle } from '@/components/theme-toggle'
import { Notifications } from '@/components/notifications'

export default function Header() {
  const { user, loading, signOut, isAdmin } = useAuth()

  const handleSignOut = async () => {
    await signOut()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
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
          <Link href="/specialties" className="text-sm font-medium hover:text-primary transition-colors">
            Especialidades
          </Link>
          <Link href="/instructors" className="text-sm font-medium hover:text-primary transition-colors">
            Instrutores
          </Link>
          <Link href="/community" className="text-sm font-medium hover:text-primary transition-colors">
            Comunidade
          </Link>
          <Link href="/ai-lab" className="text-sm font-medium hover:text-primary transition-colors flex items-center space-x-1">
            <Sparkles className="h-4 w-4" />
            <span>Laboratório da IA</span>
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
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar cursos..."
              className="w-full pl-10 pr-4 py-2 border border-input rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </div>
        </div>

        {/* User Actions */}
        <div className="flex items-center space-x-4">
          {/* Theme Toggle */}
          <SimpleThemeToggle />

          {loading ? (
            <div className="h-8 w-8 rounded-full bg-muted animate-pulse"></div>
          ) : user ? (
            <>
              {/* Notifications */}
              <Notifications />

              {/* Wishlist - apenas para usuários logados */}
              <Button variant="ghost" size="icon" className="relative">
                <Heart className="h-5 w-5" />
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                  3
                </Badge>
              </Button>

              {/* Cart - apenas para usuários logados */}
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart className="h-5 w-5" />
                <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
                  2
                </Badge>
              </Button>

              {/* User Menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-10 w-10 rounded-full p-0 hover:opacity-80 transition-opacity">
                    <Avatar className="h-10 w-10 border-2 border-primary/20">
                      <AvatarImage src={user.avatar_url || "/avatars/01.png"} alt={user.full_name || "Usuário"} />
                      <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                        {user.full_name ? user.full_name.charAt(0).toUpperCase() : user.email.charAt(0).toUpperCase()}
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
                    </>
                  )}
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
