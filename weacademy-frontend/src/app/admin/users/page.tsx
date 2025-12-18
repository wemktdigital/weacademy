'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    Users,
    Search,
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    Shield,
    RefreshCw
} from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { UserDialog } from '@/components/admin/user-dialog'
import { useToast } from '@/hooks/use-toast'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { CreditCard } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AdminUsersPage() {
    const { isAdmin, loading: authLoading } = useAuth()
    const { toast } = useToast()

    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')

    // Dialog State
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingUser, setEditingUser] = useState<any>(null)

    // Assign Plan State
    const [assignPlanOpen, setAssignPlanOpen] = useState(false)
    const [selectedUser, setSelectedUser] = useState<any>(null)
    const [availablePlans, setAvailablePlans] = useState<any[]>([])
    const [selectedPlanId, setSelectedPlanId] = useState('')
    const [processingPlan, setProcessingPlan] = useState(false)

    const router = useRouter()

    useEffect(() => {
        if (!authLoading && !isAdmin) {
            toast({
                title: 'Acesso Negado',
                description: 'Você precisa ser administrador para acessar esta página.',
                variant: 'destructive',
            })
            router.push('/auth/login')
        } else if (isAdmin) {
            loadUsers()
            loadPlans()
        }
    }, [isAdmin, authLoading, router])

    const loadPlans = async () => {
        const { data, error } = await supabase
            .from('plans')
            .select('id, name, is_active')
            // .eq('is_active', true) // Temporarily disabled to debug visibility
            .order('name')

        if (error) {
            console.error('Error loading plans:', error)
            toast({
                title: 'Erro ao carregar planos',
                description: error.message,
                variant: 'destructive',
            })
            return
        }

        if (data) {
            console.log('Plans loaded:', data)
            setAvailablePlans(data)
        }
    }

    const loadUsers = async () => {
        setLoading(true)
        try {
            const response = await fetch('/api/admin/users')

            if (!response.ok) {
                const text = await response.text()
                try {
                    const errorJson = JSON.parse(text)
                    throw new Error(errorJson.error || 'Falha ao carregar usuários')
                } catch (e: any) {
                    throw new Error(text || 'Falha ao carregar usuários (Erro ' + response.status + ')')
                }
            }

            const data = await response.json()
            setUsers(data)
        } catch (error: any) {
            console.error(error)
            toast({
                title: 'Erro',
                description: error.message || 'Não foi possível carregar a lista de usuários.',
                variant: 'destructive',
            })
        } finally {
            setLoading(false)
        }
    }

    const handleSaveUser = async (data: any) => {
        try {
            let response
            if (editingUser) {
                // Update
                response = await fetch(`/api/admin/users/${editingUser.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
            } else {
                // Create
                response = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data),
                })
            }

            if (!response.ok) {
                const text = await response.text()
                try {
                    const errorJson = JSON.parse(text)
                    throw new Error(errorJson.error || 'Falha ao salvar usuário')
                } catch (e: any) {
                    throw new Error(text || 'Falha ao salvar usuário (Erro ' + response.status + ')')
                }
            }

            toast({
                title: 'Sucesso',
                description: `Usuário ${editingUser ? 'atualizado' : 'criado'} com sucesso.`,
            })

            loadUsers()
        } catch (error: any) {
            console.error(error)
            toast({
                title: 'Erro',
                description: error.message,
                variant: 'destructive',
            })
            throw error // Re-throw to keep dialog open if needed, or handle in dialog
        }
    }

    const handleDeleteUser = async (userId: string) => {
        if (!confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return

        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: 'DELETE',
            })

            if (!response.ok) throw new Error('Falha ao excluir usuário')

            toast({
                title: 'Sucesso',
                description: 'Usuário excluído com sucesso.',
            })

            loadUsers()
        } catch (error) {
            console.error(error)
            toast({
                title: 'Erro',
                description: 'Não foi possível excluir o usuário.',
                variant: 'destructive',
            })
        }
    }

    const openAssignPlanDialog = (user: any) => {
        setSelectedUser(user)
        setSelectedPlanId('')
        setAssignPlanOpen(true)
    }

    const handleAssignPlan = async () => {
        if (!selectedUser || !selectedPlanId) return

        try {
            setProcessingPlan(true)

            // 1. Check if user already has a sub
            const { data: existingSub } = await supabase
                .from('subscriptions')
                .select('id')
                .eq('user_id', selectedUser.id)
                .in('status', ['active', 'trialing'])
                .single()

            if (existingSub) {
                // Update existing
                const { error } = await supabase
                    .from('subscriptions')
                    .update({
                        plan_id: selectedPlanId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existingSub.id)

                if (error) throw error
            } else {
                // Create new manual subscription
                const { error } = await supabase
                    .from('subscriptions')
                    .insert([{
                        user_id: selectedUser.id,
                        plan_id: selectedPlanId,
                        status: 'active',
                        current_period_start: new Date().toISOString(),
                        current_period_end: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString(), // 1 year default
                    }])

                if (error) throw error
            }

            toast({
                title: 'Sucesso',
                description: 'Plano atribuído com sucesso!',
            })
            setAssignPlanOpen(false)
        } catch (error: any) {
            console.error(error)
            toast({
                title: 'Erro',
                description: 'Erro ao atribuir plano',
                variant: 'destructive',
            })
        } finally {
            setProcessingPlan(false)
        }
    }

    const openCreateDialog = () => {
        setEditingUser(null)
        setDialogOpen(true)
    }

    const openEditDialog = (user: any) => {
        setEditingUser(user)
        setDialogOpen(true)
    }

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )

    const getRoleBadgeVariant = (role: string) => {
        switch (role) {
            case 'admin': return 'default'
            case 'user': return 'secondary'
            case 'guest': return 'outline'
            default: return 'outline'
        }
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="container mx-auto px-4 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary mb-2 inline-block">
                                ← Voltar para Dashboard
                            </Link>
                            <h1 className="text-3xl font-bold flex items-center space-x-2">
                                <Users className="h-8 w-8 text-primary" />
                                <span>Gerenciar Usuários</span>
                            </h1>
                            <p className="text-muted-foreground mt-1">
                                Crie, edite e remova usuários do sistema.
                            </p>
                        </div>
                        <Button onClick={openCreateDialog}>
                            <Plus className="h-4 w-4 mr-2" />
                            Novo Usuário
                        </Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-8">
                <Card>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle>Todos os Usuários</CardTitle>
                                <CardDescription>Lista completa de usuários cadastrados.</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="relative w-64">
                                    <Input
                                        placeholder="Buscar por nome ou email..."
                                        className="h-10"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" size="icon" onClick={loadUsers} disabled={loading} title="Atualizar Lista">
                                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="border rounded-lg">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Usuário</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Criado em</TableHead>
                                        <TableHead className="text-right">Ações</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {loading ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Carregando usuários...
                                            </TableCell>
                                        </TableRow>
                                    ) : filteredUsers.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                                                Nenhum usuário encontrado.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredUsers.map((user) => (
                                            <TableRow key={user.id}>
                                                <TableCell>
                                                    <div className="font-medium">{user.full_name || 'Sem nome'}</div>
                                                </TableCell>
                                                <TableCell>{user.email}</TableCell>
                                                <TableCell>
                                                    <Badge variant={getRoleBadgeVariant(user.role)}>
                                                        {user.role}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>
                                                    {new Date(user.created_at).toLocaleDateString('pt-BR')}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <DropdownMenu>
                                                        <DropdownMenuTrigger asChild>
                                                            <Button variant="ghost" className="h-8 w-8 p-0">
                                                                <span className="sr-only">Abrir menu</span>
                                                                <MoreHorizontal className="h-4 w-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuLabel>Ações</DropdownMenuLabel>
                                                            <DropdownMenuItem onClick={() => openEditDialog(user)}>
                                                                <Pencil className="mr-2 h-4 w-4" />
                                                                Editar
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem onClick={() => openAssignPlanDialog(user)}>
                                                                <CreditCard className="mr-2 h-4 w-4" />
                                                                Atribuir Plano
                                                            </DropdownMenuItem>
                                                            <DropdownMenuItem
                                                                className="text-red-600 focus:text-red-600"
                                                                onClick={() => handleDeleteUser(user.id)}
                                                            >
                                                                <Trash2 className="mr-2 h-4 w-4" />
                                                                Excluir
                                                            </DropdownMenuItem>
                                                        </DropdownMenuContent>
                                                    </DropdownMenu>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <UserDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                user={editingUser}
                onSave={handleSaveUser}
            />

            <Dialog open={assignPlanOpen} onOpenChange={setAssignPlanOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Atribuir Plano</DialogTitle>
                        <DialogDescription>
                            Atribua manualmente um plano para <strong>{selectedUser?.full_name || selectedUser?.email}</strong>.
                            Isso criará uma assinatura ativa sem cobrar o usuário.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>Selecione o Plano</Label>
                        <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                                {availablePlans.map(plan => (
                                    <SelectItem key={plan.id} value={plan.id}>{plan.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAssignPlanOpen(false)}>Cancelar</Button>
                        <Button onClick={handleAssignPlan} disabled={processingPlan || !selectedPlanId}>
                            {processingPlan && <RefreshCw className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar Assinatura
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
