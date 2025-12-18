'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Eye,
  Filter,
  BookOpen,
  Users,
  TrendingUp,
  ExternalLink
} from 'lucide-react'
import { toast } from '@/hooks/use-toast'
import { supabase } from '@/lib/supabase'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { showActionableError, showSuccessMessage } from '@/lib/feedback'

interface Course {
  id: string
  title: string
  slug: string
  description: string | null
  thumbnail_url: string | null
  price: number
  is_free: boolean
  is_published: boolean
  status: 'draft' | 'published' | 'archived'
  level: 'beginner' | 'intermediate' | 'advanced'
  created_at: string
  category: {
    id: string
    name: string
  } | null
}

export default function AdminCoursesPage() {
  const { user, isAdmin } = useAuth()
  const router = useRouter()
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [levelFilter, setLevelFilter] = useState<string>('all')
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean, courseId: string | null }>({
    open: false,
    courseId: null
  })
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!user || !isAdmin) {
      router.push('/access-denied')
      return
    }

    loadCourses()
  }, [user, isAdmin, router])

  const loadCourses = async () => {
    try {
      setLoading(true)

      let query = supabase
        .from('courses')
        .select('*, category:categories(id, name)')
        .order('created_at', { ascending: false })

      // Aplicar filtros
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter)
      }
      if (levelFilter !== 'all') {
        query = query.eq('level', levelFilter)
      }
      if (search) {
        query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%`)
      }

      const { data, error } = await query

      if (error) throw error
      setCourses(data || [])
    } catch (error: any) {
      showActionableError(error, { action: 'Tentar novamente', message: 'Erro ao carregar cursos' }, toast)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = (courseId: string) => {
    setDeleteDialog({ open: true, courseId })
  }

  const confirmDelete = async () => {
    if (!deleteDialog.courseId) return

    setIsDeleting(true)
    try {
      // Obter sessão
      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Não autenticado')
      }

      // Deletar via API
      const response = await fetch(`/api/courses/${deleteDialog.courseId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao deletar curso')
      }

      showSuccessMessage({ action: 'curso deletado', entity: 'curso' }, toast)

      setDeleteDialog({ open: false, courseId: null })
      loadCourses()
    } catch (error: any) {
      showActionableError(error, { action: 'Tentar novamente', message: 'Erro ao deletar curso' }, toast)
    } finally {
      setIsDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <p>Carregando...</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Cursos</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie todos os cursos da plataforma
          </p>
        </div>
        <Button onClick={() => router.push('/admin/courses/new')}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Curso
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span className="text-sm">Total de Cursos</span>
          </div>
          <div className="text-2xl font-bold mt-2">{courses.length}</div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span className="text-sm">Publicados</span>
          </div>
          <div className="text-2xl font-bold mt-2">
            {courses.filter(c => c.is_published).length}
          </div>
        </div>
        <div className="p-4 border rounded-lg">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="h-4 w-4" />
            <span className="text-sm">Rascunhos</span>
          </div>
          <div className="text-2xl font-bold mt-2">
            {courses.filter(c => !c.is_published).length}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cursos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Status</SelectItem>
            <SelectItem value="published">Publicados</SelectItem>
            <SelectItem value="draft">Rascunhos</SelectItem>
            <SelectItem value="archived">Arquivados</SelectItem>
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Nível" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os Níveis</SelectItem>
            <SelectItem value="beginner">Iniciante</SelectItem>
            <SelectItem value="intermediate">Intermediário</SelectItem>
            <SelectItem value="advanced">Avançado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Curso</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Nível</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {courses.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                  Nenhum curso encontrado
                </TableCell>
              </TableRow>
            ) : (
              courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {course.thumbnail_url && (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="w-12 h-12 rounded object-cover"
                        />
                      )}
                      <div>
                        <div className="font-medium">{course.title}</div>
                        <div className="text-sm text-muted-foreground">
                          {course.slug}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {course.category ? (
                      <Badge variant="secondary">{course.category.name}</Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {course.is_free ? (
                      <Badge className="bg-green-500">Grátis</Badge>
                    ) : (
                      <span className="font-medium">
                        R$ {course.price.toFixed(2)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        course.status === 'published'
                          ? 'default'
                          : course.status === 'archived'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {course.status === 'published' ? 'Publicado' : course.status === 'draft' ? 'Rascunho' : 'Arquivado'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {course.level === 'beginner' ? 'Iniciante' : course.level === 'intermediate' ? 'Intermediário' : 'Avançado'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Ver como aluno"
                        onClick={() => window.open(`/courses/${course.slug}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Detalhes"
                        onClick={() => router.push(`/admin/courses/${course.id}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => router.push(`/admin/courses/${course.id}/edit`)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Excluir"
                        onClick={() => handleDelete(course.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Delete Dialog - Melhorado */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
        onConfirm={confirmDelete}
        title="Confirmar Exclusão"
        description="Tem certeza que deseja deletar este curso? Esta ação não pode ser desfeita. Todas as aulas, materiais e dados relacionados serão permanentemente removidos."
        confirmText="Sim, Deletar"
        cancelText="Cancelar"
        variant="destructive"
        isLoading={isDeleting}
      />
    </div>
  )
}
