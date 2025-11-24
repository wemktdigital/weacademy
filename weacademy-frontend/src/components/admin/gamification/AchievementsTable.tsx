'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { Edit, Trash2, Power, PowerOff, Search } from 'lucide-react'
import { toast } from 'sonner'

export interface Achievement {
  id: string
  code: string
  name: string
  description: string
  icon: string
  category: 'courses' | 'quizzes' | 'lab-ia' | 'community' | 'special'
  points: number
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  active: boolean
  sort_order: number
  unlocked_count?: number
}

interface AchievementsTableProps {
  achievements: Achievement[]
  onEdit: (achievement: Achievement) => void
  onDelete: (id: string) => Promise<void>
  onToggleActive: (id: string, active: boolean) => Promise<void>
  loading?: boolean
}

const CATEGORY_LABELS = {
  courses: 'Cursos',
  quizzes: 'Quizzes',
  'lab-ia': 'Lab IA',
  community: 'Comunidade',
  special: 'Especial',
}

const RARITY_COLORS = {
  common: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100',
  rare: 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100',
  epic: 'bg-purple-100 text-purple-800 dark:bg-purple-800 dark:text-purple-100',
  legendary: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100',
}

export function AchievementsTable({
  achievements,
  onEdit,
  onDelete,
  onToggleActive,
  loading = false,
}: AchievementsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [rarityFilter, setRarityFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const filteredAchievements = achievements.filter((achievement) => {
    const matchesSearch =
      achievement.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      achievement.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      achievement.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesCategory = categoryFilter === 'all' || achievement.category === categoryFilter
    const matchesRarity = rarityFilter === 'all' || achievement.rarity === rarityFilter
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'active' && achievement.active) ||
      (statusFilter === 'inactive' && !achievement.active)

    return matchesSearch && matchesCategory && matchesRarity && matchesStatus
  })

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await onDelete(deleteId)
      toast.success('Achievement deletado com sucesso!')
      setDeleteId(null)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar achievement')
    }
  }

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await onToggleActive(id, !currentActive)
      toast.success(`Achievement ${!currentActive ? 'ativado' : 'desativado'} com sucesso!`)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao alterar status')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar achievements..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Categorias</SelectItem>
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={rarityFilter} onValueChange={setRarityFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Raridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas Raridades</SelectItem>
            <SelectItem value="common">Comum</SelectItem>
            <SelectItem value="rare">Raro</SelectItem>
            <SelectItem value="epic">Épico</SelectItem>
            <SelectItem value="legendary">Lendário</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos Status</SelectItem>
            <SelectItem value="active">Ativo</SelectItem>
            <SelectItem value="inactive">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabela */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">Ícone</TableHead>
              <TableHead>Código</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>Categoria</TableHead>
              <TableHead>Pontos</TableHead>
              <TableHead>Raridade</TableHead>
              <TableHead>Desbloqueados</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <span className="ml-2 text-muted-foreground">Carregando...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredAchievements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum achievement encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredAchievements.map((achievement) => (
                <TableRow key={achievement.id}>
                  <TableCell>
                    <span className="text-2xl">{achievement.icon || '🏆'}</span>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {achievement.code}
                    </code>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{achievement.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                        {achievement.description}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {CATEGORY_LABELS[achievement.category]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">{achievement.points}</span> XP
                  </TableCell>
                  <TableCell>
                    <Badge className={RARITY_COLORS[achievement.rarity]}>
                      {achievement.rarity}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {achievement.unlocked_count !== undefined
                        ? `${achievement.unlocked_count} usuário(s)`
                        : '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={achievement.active ? 'default' : 'secondary'}>
                      {achievement.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleActive(achievement.id, achievement.active)}
                        title={achievement.active ? 'Desativar' : 'Ativar'}
                      >
                        {achievement.active ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(achievement)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(achievement.id)}
                        title="Deletar"
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

      {/* Dialog de Confirmação de Exclusão */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar este achievement? Esta ação não pode ser desfeita.
              Todos os usuários que desbloquearam este achievement perderão o badge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

