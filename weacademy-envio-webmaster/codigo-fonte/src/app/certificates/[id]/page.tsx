'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Download, CheckCircle, Calendar } from 'lucide-react'

interface Certificate {
  id: string
  certificate_number: string
  issued_at: string
  course: {
    title: string
  }
  user: {
    full_name: string
  }
}

export default function CertificatePage() {
  const params = useParams()
  const [certificate, setCertificate] = useState<Certificate | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCertificate()
  }, [params.id])

  const fetchCertificate = async () => {
    try {
      const { data, error } = await supabase
        .from('certificates')
        .select(`
          *,
          course:courses(title),
          user:profiles!certificates_user_id_fkey(full_name)
        `)
        .eq('id', params.id)
        .single()

      if (error) throw error
      
      setCertificate(data)
    } catch (error: any) {
      console.error('Error fetching certificate:', error)
      setError('Certificado não encontrado')
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    // TODO: Implementar geração e download de PDF
    alert('Funcionalidade de download em desenvolvimento')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">Carregando...</div>
      </div>
    )
  }

  if (error || !certificate) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Certificado não encontrado</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.history.back()}>
              Voltar
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Certificate Display */}
        <Card className="border-2 border-primary/20 shadow-2xl">
          <CardHeader className="text-center bg-gradient-to-r from-primary/10 to-secondary/10">
            <div className="mb-4">
              <CheckCircle className="h-16 w-16 text-primary mx-auto mb-4" />
              <h1 className="text-3xl font-bold">Certificado de Conclusão</h1>
            </div>
          </CardHeader>
          <CardContent className="py-12 px-8">
            <div className="text-center space-y-6">
              <p className="text-lg text-muted-foreground">Este certificado comprova que</p>
              <h2 className="text-4xl font-bold text-primary">
                {certificate.user.full_name}
              </h2>
              <p className="text-lg text-muted-foreground">concluiu com sucesso o curso</p>
              <h3 className="text-2xl font-semibold">
                {certificate.course.title}
              </h3>
              <div className="flex items-center justify-center gap-2 mt-8">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                <span className="text-muted-foreground">
                  {new Date(certificate.issued_at).toLocaleDateString('pt-BR')}
                </span>
              </div>
              <div className="mt-8 pt-8 border-t">
                <p className="text-sm text-muted-foreground mb-2">
                  Número do Certificado
                </p>
                <p className="font-mono text-lg font-semibold">
                  {certificate.certificate_number}
                </p>
              </div>
            </div>
          </CardContent>
          <div className="border-t p-6 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Verificado por WE Academy
                </p>
                <Badge variant="secondary" className="mt-1">
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Válido
                </Badge>
              </div>
              <Button onClick={handleDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
            </div>
          </div>
        </Card>

        {/* Verification Info */}
        <Card className="mt-6">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground text-center">
              Este certificado é verificado e pode ser conferido através do número acima
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
