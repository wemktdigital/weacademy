'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { KnowledgeDocument } from '@/lib/validations/knowledgeBase.schema'
import { Upload, FileText, X, ArrowLeft, Loader2, CheckCircle2, XCircle, Search } from 'lucide-react'

export default function KnowledgeBaseDocumentsPage() {
  const params = useParams()
  const router = useRouter()
  const knowledgeBaseId = params.id as string

  const [documents, setDocuments] = useState<KnowledgeDocument[]>([])
  const [knowledgeBase, setKnowledgeBase] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [openUploadDialog, setOpenUploadDialog] = useState(false)
  const [deleteDocId, setDeleteDocId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetchKnowledgeBase()
    fetchDocuments()
    
    // Polling para atualizar status de processamento
    const interval = setInterval(() => {
      const hasProcessing = documents.some(doc => doc.processing_status === 'processing' || doc.processing_status === 'pending')
      if (hasProcessing) {
        fetchDocuments()
      }
    }, 5000) // Atualizar a cada 5 segundos

    return () => clearInterval(interval)
  }, [knowledgeBaseId])

  const fetchKnowledgeBase = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/knowledge-bases`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch knowledge base')
      const data = await response.json()
      const kb = data.knowledge_bases?.find((kb: any) => kb.id === knowledgeBaseId)
      setKnowledgeBase(kb)
    } catch (error) {
      console.error('Error fetching knowledge base:', error)
    }
  }

  const fetchDocuments = async () => {
    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/knowledge-bases/${knowledgeBaseId}/documents`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to fetch documents')
      const data = await response.json()
      setDocuments(data.documents || [])
    } catch (error) {
      console.error('Error fetching documents:', error)
      toast.error('Erro ao carregar documentos')
    } finally {
      setLoading(false)
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    const file = fileInputRef.current?.files?.[0]

    if (!file) {
      toast.error('Selecione um arquivo')
      return
    }

    // Validar tipo de arquivo
    const validTypes = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/markdown']
    const validExtensions = ['.pdf', '.txt', '.docx', '.md']
    const fileExtension = file.name.toLowerCase().split('.').pop()

    if (!validTypes.includes(file.type) && !validExtensions.includes(`.${fileExtension}`)) {
      toast.error('Tipo de arquivo não suportado. Use PDF, TXT, DOCX ou MD')
      return
    }

    setUploading(true)

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(`/api/lab-ia/admin/knowledge-bases/${knowledgeBaseId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Erro desconhecido' }))
        throw new Error(errorData.error || 'Erro ao fazer upload do documento')
      }

      toast.success('Documento enviado! Processamento em andamento...')
      setOpenUploadDialog(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      fetchDocuments()
      
      // Iniciar polling para acompanhar processamento
      setTimeout(() => {
        fetchDocuments()
      }, 2000)
    } catch (error: any) {
      console.error('Error uploading document:', error)
      toast.error(error.message || 'Erro ao fazer upload do documento')
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteDocId) return

    try {
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      const response = await fetch(`/api/lab-ia/admin/knowledge-bases/${knowledgeBaseId}/documents/${deleteDocId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (!response.ok) throw new Error('Failed to delete document')

      toast.success('Documento deletado!')
      setDeleteDocId(null)
      fetchDocuments()
    } catch (error) {
      console.error('Error deleting document:', error)
      toast.error('Erro ao deletar documento')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <Badge variant="default" className="bg-green-500">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Processado
          </Badge>
        )
      case 'processing':
        return (
          <Badge variant="default" className="bg-blue-500">
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
            Processando
          </Badge>
        )
      case 'failed':
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Erro
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            Pendente
          </Badge>
        )
    }
  }

  const filteredDocuments = documents.filter(doc =>
    doc.filename.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center">Carregando documentos...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push('/ai-lab/admin/knowledge-bases')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Documentos</h1>
            {knowledgeBase && (
              <p className="text-muted-foreground mt-1">
                Knowledge Base: {knowledgeBase.name}
              </p>
            )}
          </div>
        </div>
        <Button onClick={() => setOpenUploadDialog(true)}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Documento
        </Button>
      </div>

      {/* Busca */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar documentos..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Lista de documentos */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredDocuments.map((doc) => (
          <Card key={doc.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    {doc.filename}
                  </CardTitle>
                  {getStatusBadge(doc.processing_status || 'pending')}
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteDocId(doc.id!)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <Label className="text-muted-foreground">Tipo</Label>
                  <p className="font-semibold uppercase">{doc.file_type}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Tamanho</Label>
                  <p className="font-semibold">
                    {doc.file_size ? `${(doc.file_size / 1024).toFixed(1)} KB` : 'N/A'}
                  </p>
                </div>
              </div>

              {doc.processing_status === 'completed' && doc.raw_content && (
                <div className="text-sm text-muted-foreground">
                  <p>
                    Caracteres: {doc.raw_content.length.toLocaleString()}
                  </p>
                </div>
              )}

              {doc.error_message && (
                <div className="text-sm text-red-500">
                  <p className="font-semibold">Erro:</p>
                  <p>{doc.error_message}</p>
                </div>
              )}

              {doc.processed_at && (
                <div className="text-xs text-muted-foreground">
                  Processado em: {new Date(doc.processed_at).toLocaleString('pt-BR')}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredDocuments.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? 'Nenhum documento encontrado' : 'Nenhum documento carregado. Clique em "Upload Documento" para começar.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Dialog de upload */}
      <Dialog open={openUploadDialog} onOpenChange={setOpenUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload de Documento</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label htmlFor="file">Arquivo (PDF, TXT, DOCX, MD)</Label>
              <Input
                id="file"
                type="file"
                ref={fileInputRef}
                accept=".pdf,.txt,.docx,.md"
                required
              />
              <p className="text-xs text-muted-foreground mt-1">
                Formatos suportados: PDF, TXT, DOCX, MD (máx. 10MB)
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpenUploadDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={uploading}>
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Enviar
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={!!deleteDocId} onOpenChange={(open) => !open && setDeleteDocId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este documento? Todos os chunks e embeddings serão deletados. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Deletar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

