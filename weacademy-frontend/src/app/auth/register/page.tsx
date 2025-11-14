'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { BookOpen, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  
  const { signUp } = useAuth()
  const router = useRouter()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validações
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem')
      return
    }

    if (formData.password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await signUp(formData.email, formData.password, formData.fullName)
      
      if (error) {
        setError(error.message)
      } else if (data) {
        // Verificar se a sessão foi criada automaticamente
        // Se sim, fazer login automático e redirecionar para home
        // Se não, redirecionar para login
        if (data.session) {
          // Sessão criada automaticamente - aguardar contexto atualizar e redirecionar
          await new Promise(resolve => setTimeout(resolve, 500))
          router.push('/?message=Conta criada com sucesso! Bem-vindo à WE Academy.')
        } else {
          // Precisa confirmar email ou fazer login manual
          router.push('/auth/login?message=Conta criada com sucesso! Faça login para continuar.')
        }
      }
    } catch (err) {
      setError('Erro inesperado. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/5 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo */}
        <div className="text-center">
          <Link href="/" className="flex items-center justify-center space-x-2">
            <BookOpen className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold">WE Academy</span>
          </Link>
          <h2 className="mt-6 text-3xl font-bold text-foreground">
            Crie sua conta
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ou{' '}
            <Link href="/auth/login" className="font-medium text-primary hover:text-primary/80">
              faça login na sua conta existente
            </Link>
          </p>
        </div>

        {/* Register Form */}
        <Card>
          <CardHeader>
            <CardTitle>Criar Conta</CardTitle>
            <CardDescription>
              Preencha os dados abaixo para criar sua conta
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    type="text"
                    placeholder="Seu nome completo"
                    value={formData.fullName}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Mínimo 6 caracteres"
                    value={formData.password}
                    onChange={handleChange}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    placeholder="Confirme sua senha"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    className="pl-10 pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <input
                  id="terms"
                  name="terms"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
                  required
                />
                <Label htmlFor="terms" className="text-sm">
                  Eu aceito os{' '}
                  <Link href="/terms" className="text-primary hover:text-primary/80">
                    Termos de Uso
                  </Link>{' '}
                  e{' '}
                  <Link href="/privacy" className="text-primary hover:text-primary/80">
                    Política de Privacidade
                  </Link>
                </Label>
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Criando conta...' : 'Criar Conta'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
