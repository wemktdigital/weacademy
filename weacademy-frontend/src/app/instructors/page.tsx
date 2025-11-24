'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { User, ArrowLeft } from 'lucide-react'

export default function InstructorsPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="container max-w-2xl">
        <Card className="text-center py-16 px-8">
          <CardContent className="space-y-6">
            <div className="flex justify-center mb-6">
              <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-10 w-10 text-primary" />
              </div>
            </div>
            
            <h1 className="text-3xl lg:text-4xl font-bold">
              Instrutores
            </h1>
            
            <p className="text-xl text-muted-foreground">
              Em breve você poderá conhecer todos os nossos instrutores especializados.
            </p>
            
            <p className="text-muted-foreground">
              Estamos preparando perfis detalhados dos nossos especialistas e professores.
            </p>
            
            <div className="pt-4">
              <Button asChild>
                <Link href="/courses">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Voltar para Cursos
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

