import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertTriangle, ArrowLeft, Home, Shield } from 'lucide-react'

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 via-background to-red-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Error Icon */}
        <div className="text-center">
          <div className="mx-auto h-24 w-24 bg-red-100 rounded-full flex items-center justify-center">
            <AlertTriangle className="h-12 w-12 text-red-600" />
          </div>
          <h1 className="mt-6 text-4xl font-bold text-red-600">
            Acesso Negado
          </h1>
          <p className="mt-2 text-lg text-muted-foreground">
            Você não tem permissão para acessar esta página
          </p>
        </div>

        {/* Error Details */}
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="text-red-600 flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Acesso Restrito</span>
            </CardTitle>
            <CardDescription>
              Esta área é restrita a usuários com permissões especiais
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg">
              <h4 className="font-medium text-red-800 mb-2">Possíveis motivos:</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Você não está logado</li>
                <li>• Sua conta não tem as permissões necessárias</li>
                <li>• Você está tentando acessar uma área administrativa</li>
                <li>• Sua sessão expirou</li>
              </ul>
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/auth/login">
                  <Shield className="mr-2 h-4 w-4" />
                  Fazer Login
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Voltar ao Início
                </Link>
              </Button>
              
              <Button variant="ghost" asChild className="w-full">
                <Link href="javascript:history.back()">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Página Anterior
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Help Section */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <h3 className="font-medium">Precisa de ajuda?</h3>
              <p className="text-sm text-muted-foreground">
                Entre em contato conosco se você acredita que isso é um erro
              </p>
              <div className="flex justify-center space-x-4">
                <Link href="/contact" className="text-sm text-primary hover:text-primary/80">
                  Suporte
                </Link>
                <Link href="/help" className="text-sm text-primary hover:text-primary/80">
                  Central de Ajuda
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
