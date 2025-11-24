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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Edit, Trash2, GripVertical, Search } from 'lucide-react'
import { toast } from 'sonner'

export interface Level {
  id: string
  level_number: number
  name: string
  min_xp: number
  max_xp: number | null
  icon: string
  color: string
  benefits: string[]
  sort_order: number
  users_count?: number
}

interface LevelsTableProps {
  levels: Level[]
  onEdit: (level: Level) => void
  onDelete: (id: string) => Promise<void>
  loading?: boolean
}

export function LevelsTable({
  levels,
  onEdit,
  onDelete,
  loading = false,
}: LevelsTableProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const sortedLevels = [...levels].sort((a, b) => a.level_number - b.level_number)
  const filteredLevels = sortedLevels.filter((level) => {
    const matchesSearch =
      level.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      level.level_number.toString().includes(searchTerm) ||
      level.min_xp.toString().includes(searchTerm) ||
      (level.max_xp && level.max_xp.toString().includes(searchTerm))

    return matchesSearch
  })

  const handleDelete = async () => {
    if (!deleteId) return
    try {
      await onDelete(deleteId)
      toast.success('Nível deletado com sucesso!')
      setDeleteId(null)
    } catch (error: any) {
      toast.error(error.message || 'Erro ao deletar nível')
    }
  }

  return (
    <div className="space-y-4">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar níveis..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Tabela */}
      <div className="border rounded-md">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px]">#</TableHead>
              <TableHead className="w-[80px]">Ícone</TableHead>
              <TableHead>Nome</TableHead>
              <TableHead>XP Mínimo</TableHead>
              <TableHead>XP Máximo</TableHead>
              <TableHead>Usuários</TableHead>
              <TableHead>Cor</TableHead>
              <TableHead>Benefícios</TableHead>
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
            ) : filteredLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                  Nenhum nível encontrado
                </TableCell>
              </TableRow>
            ) : (
              filteredLevels.map((level) => (
                <TableRow key={level.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-4 w-4 text-muted-foreground" />
                      <span className="font-semibold">{level.level_number}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-2xl">{level.icon || '⭐'}</span>
                  </TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{level.name}</p>
                      {level.benefits.length > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {level.benefits.length} benefício(s)
                        </p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-semibold">{level.min_xp.toLocaleString()}</span> XP
                  </TableCell>
                  <TableCell>
                    {level.max_xp !== null ? (
                      <span className="font-semibold">{level.max_xp.toLocaleString()}</span>
                    ) : (
                      <span className="text-muted-foreground">∞</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {level.users_count !== undefined
                        ? `${level.users_count} usuário(s)`
                        : '-'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded border-2 border-border"
                        style={{ backgroundColor: level.color }}
                      />
                      <code className="text-xs">{level.color}</code>
                    </div>
                  </TableCell>
                  <TableCell>
                    {level.benefits.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {level.benefits.slice(0, 2).map((benefit, index) => (
                          <Badge key={index} variant="outline" className="text-xs">
                            {benefit}
                          </Badge>
                        ))}
                        {level.benefits.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{level.benefits.length - 2}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nenhum</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onEdit(level)}
                        title="Editar"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(level.id)}
                        title="Deletar"
                        disabled={level.users_count !== undefined && level.users_count > 0}
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
              Tem certeza que deseja deletar este nível? Esta ação não pode ser desfeita.
              {filteredLevels.find(l => l.id === deleteId)?.users_count && 
                ` ${filteredLevels.find(l => l.id === deleteId)?.users_count} usuário(s) estão neste nível e precisarão ser reatribuídos.`
              }
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

