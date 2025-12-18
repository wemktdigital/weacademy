'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { UserRole } from '@/lib/auth'

interface UserDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    user?: {
        id: string
        full_name: string
        email: string
        role: UserRole
    } | null
    onSave: (data: any) => Promise<void>
}

export function UserDialog({ open, onOpenChange, user, onSave }: UserDialogProps) {
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'user' as UserRole
    })
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (open) {
            if (user) {
                setFormData({
                    full_name: user.full_name || '',
                    email: user.email || '',
                    password: '', // Senha vazia na edição (só preenche se for alterar)
                    role: user.role || 'user'
                })
            } else {
                setFormData({
                    full_name: '',
                    email: '',
                    password: '',
                    role: 'user'
                })
            }
        }
    }, [open, user])

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        try {
            // Filtrar campos vazios (especialmente senha na edição)
            const dataToSave: any = { ...formData }
            if (user && !dataToSave.password) {
                delete dataToSave.password
            }
            await onSave(dataToSave)
            onOpenChange(false)
        } catch (error) {
            console.error(error)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{user ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
                    <DialogDescription>
                        {user
                            ? 'Faça alterações nos dados do usuário aqui.'
                            : 'Preencha os dados para criar um novo usuário.'}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="full_name" className="text-right">
                            Nome
                        </Label>
                        <Input
                            id="full_name"
                            value={formData.full_name}
                            onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="email" className="text-right">
                            Email
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="col-span-3"
                            required
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="role" className="text-right">
                            Função
                        </Label>
                        <Select
                            value={formData.role}
                            onValueChange={(val: UserRole) => setFormData({ ...formData, role: val })}
                        >
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Selecione um role" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="user">Usuário</SelectItem>
                                <SelectItem value="admin">Administrador</SelectItem>
                                <SelectItem value="guest">Convidado</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <Label htmlFor="password" className="text-right">
                            Senha
                        </Label>
                        <div className="col-span-3">
                            <Input
                                id="password"
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                placeholder={user ? "Deixe em branco para manter" : "Mínimo 6 caracteres"}
                                required={!user}
                                minLength={6}
                            />
                            {user && (
                                <p className="text-[0.8rem] text-muted-foreground mt-1">
                                    Apenas preencha se quiser alterar a senha.
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button type="submit" disabled={loading}>
                            {loading ? 'Salvando...' : 'Salvar Alterações'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
