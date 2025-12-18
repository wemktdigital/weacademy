'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from '@/components/ui/dialog'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { CreditCard, Plus, Pencil, Trash2, Check, X, AlertCircle, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

import { AVAILABLE_MODELS as SYSTEM_MODELS, PROVIDERS } from '@/modules/laboratorio-ia/config/models'

interface Plan {
    id: string
    name: string
    description: string | null
    price: number
    interval: 'monthly' | 'yearly'
    stripe_price_id: string | null
    features: string[]
    is_active: boolean
    created_at: string
    model_limits: Record<string, number>
}

interface ModelLimit {
    model: string
    limit: number
}

// Group models by provider for easier selection
const MODELS_BY_PROVIDER = PROVIDERS.map(provider => ({
    provider: provider.label,
    models: SYSTEM_MODELS.filter(m => m.provider === provider.value)
})).filter(group => group.models.length > 0)

export default function PlansPage() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingPlan, setEditingPlan] = useState<Plan | null>(null)

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        price: '',
        interval: 'monthly',
        stripe_price_id: '',
        features: '', // Textarea (one per line)
        is_active: true,
        model_limits: [] as ModelLimit[]
    })

    // Limits Form State
    const [newLimitModel, setNewLimitModel] = useState('')
    const [newLimitValue, setNewLimitValue] = useState('')

    const addModelLimit = () => {
        if (!newLimitModel || !newLimitValue) return

        const limit = parseInt(newLimitValue)
        setFormData(prev => ({
            ...prev,
            model_limits: [
                ...prev.model_limits.filter(l => l.model !== newLimitModel),
                { model: newLimitModel, limit }
            ]
        }))
        setNewLimitModel('')
        setNewLimitValue('')
    }

    const removeModelLimit = (model: string) => {
        setFormData(prev => ({
            ...prev,
            model_limits: prev.model_limits.filter(l => l.model !== model)
        }))
    }

    useEffect(() => {
        fetchPlans()
    }, [])

    useEffect(() => {
        if (editingPlan) {
            setFormData({
                name: editingPlan.name,
                description: editingPlan.description || '',
                price: editingPlan.price.toString(),
                interval: editingPlan.interval,
                stripe_price_id: editingPlan.stripe_price_id || '',
                features: Array.isArray(editingPlan.features) ? editingPlan.features.join('\n') : '',
                is_active: editingPlan.is_active,
                model_limits: Object.entries(editingPlan.model_limits || {}).map(([model, limit]) => ({
                    model,
                    limit: limit as number
                }))
            })
        } else {
            setFormData({
                name: '',
                description: '',
                price: '',
                interval: 'monthly',
                stripe_price_id: '',
                features: '',
                is_active: true,
                model_limits: []
            })
        }
    }, [editingPlan])

    const fetchPlans = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .order('price', { ascending: true })

            if (error) throw error
            setPlans(data || [])
        } catch (error: any) {
            console.error('Error fetching plans:', error)
            toast.error('Erro ao carregar planos')
        } finally {
            setLoading(false)
        }
    }

    const handleSave = async () => {
        if (!formData.name || !formData.price || !formData.interval) {
            toast.error('Preencha os campos obrigatórios')
            return
        }

        try {
            setSaving(true)

            const featuresList = formData.features
                .split('\n')
                .map(f => f.trim())
                .filter(f => f.length > 0)

            const modelLimitsRecord = formData.model_limits.reduce((acc, curr) => ({
                ...acc,
                [curr.model]: curr.limit
            }), {})

            const payload = {
                name: formData.name,
                description: formData.description,
                price: parseFloat(formData.price),
                interval: formData.interval,
                stripe_price_id: formData.stripe_price_id, // Passed but API handles sync
                features: featuresList,
                is_active: formData.is_active,
                model_limits: modelLimitsRecord
            }

            let response

            if (editingPlan) {
                // Update via API
                response = await fetch('/api/admin/plans', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ...payload, id: editingPlan.id })
                })
            } else {
                // Create via API
                response = await fetch('/api/admin/plans', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                })
            }

            const result = await response.json()

            if (!response.ok) {
                throw new Error(result.error || 'Erro ao processar requisição')
            }

            toast.success(editingPlan ? 'Plano atualizado com sucesso' : 'Plano criado com sucesso')
            setIsDialogOpen(false)
            fetchPlans()
        } catch (error: any) {
            console.error('Error saving plan:', error)
            toast.error(error.message || 'Erro ao salvar plano')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza que deseja excluir este plano? Isso arquivará o preço no Stripe.')) return

        try {
            const response = await fetch(`/api/admin/plans?id=${id}`, {
                method: 'DELETE'
            })

            if (!response.ok) {
                const result = await response.json()
                throw new Error(result.error || 'Erro ao excluir plano')
            }

            toast.success('Plano removido')
            fetchPlans()
        } catch (error: any) {
            console.error('Error deleting plan:', error)
            toast.error('Erro ao remover plano')
        }
    }

    return (
        <div className="container mx-auto px-4 py-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <CreditCard className="h-8 w-8 text-primary" />
                        Planos de Assinatura
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gerencie os planos e preços disponíveis para os usuários
                    </p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={(open) => {
                    setIsDialogOpen(open)
                    if (!open) setEditingPlan(null)
                }}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="mr-2 h-4 w-4" />
                            Novo Plano
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[600px]">
                        <DialogHeader>
                            <DialogTitle>{editingPlan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
                            <DialogDescription>
                                Configure os detalhes do plano de assinatura.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nome do Plano *</Label>
                                    <Input
                                        id="name"
                                        placeholder="Ex: Pro Mensal"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="price">Preço (R$) *</Label>
                                    <Input
                                        id="price"
                                        type="number"
                                        step="0.01"
                                        placeholder="0.00"
                                        value={formData.price}
                                        onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="interval">Intervalo</Label>
                                    <Select
                                        value={formData.interval}
                                        onValueChange={(val) => setFormData({ ...formData, interval: val as any })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="monthly">Mensal</SelectItem>
                                            <SelectItem value="yearly">Anual</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="stripe_id">ID Stripe (Gerado Automático)</Label>
                                    <Input
                                        id="stripe_id"
                                        placeholder="Será gerado ao salvar..."
                                        value={formData.stripe_price_id}
                                        disabled
                                        className="bg-muted text-muted-foreground"
                                    />
                                </div>
                            </div>

                            {/* AI Model Limits Section */}
                            <div className="space-y-3 pt-2 border-t">
                                <Label>Limites de Modelos de IA</Label>
                                <div className="border rounded-md p-3 space-y-3 bg-muted/20">
                                    <div className="flex gap-2">
                                        <Select value={newLimitModel} onValueChange={setNewLimitModel}>
                                            <SelectTrigger className="w-[200px]">
                                                <SelectValue placeholder="Selecionar Modelo" />
                                            </SelectTrigger>
                                            <SelectContent className="max-h-[300px]">
                                                {MODELS_BY_PROVIDER.map((group) => (
                                                    <div key={group.provider}>
                                                        <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground bg-muted/30">
                                                            {group.provider}
                                                        </div>
                                                        {group.models.map(model => (
                                                            <SelectItem key={model.model} value={model.model}>
                                                                <span className="flex items-center gap-2">
                                                                    <span>{model.icon}</span>
                                                                    <span>{model.displayName}</span>
                                                                </span>
                                                            </SelectItem>
                                                        ))}
                                                    </div>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <Input
                                            type="number"
                                            placeholder="Limite (-1: ilimitado)"
                                            className="flex-1"
                                            value={newLimitValue}
                                            onChange={(e) => setNewLimitValue(e.target.value)}
                                        />
                                        <Button type="button" size="icon" variant="secondary" onClick={addModelLimit}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>

                                    {/* List of configured limits */}
                                    <div className="space-y-2">
                                        {formData.model_limits.length > 0 ? (
                                            formData.model_limits.map((limit) => {
                                                const modelInfo = SYSTEM_MODELS.find(m => m.model === limit.model)
                                                return (
                                                    <div key={limit.model} className="flex items-center justify-between bg-background p-2 rounded border">
                                                        <div className="flex items-center gap-2">
                                                            <div className="flex items-center gap-1.5 text-sm font-medium">
                                                                <span>{modelInfo?.icon || '🤖'}</span>
                                                                <span>{modelInfo?.displayName || limit.model}</span>
                                                            </div>
                                                            <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded-full">
                                                                {limit.limit === -1 ? 'Ilimitado' : `${limit.limit}/mês`}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                                            onClick={() => removeModelLimit(limit.model)}
                                                        >
                                                            <X className="h-3 w-3" />
                                                        </Button>
                                                    </div>
                                                )
                                            })
                                        ) : (
                                            <p className="text-xs text-muted-foreground text-center py-2">Nenhum limite configurado</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Descrição Curta</Label>
                                <Input
                                    id="description"
                                    placeholder="Seu plano mais popular..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="features">Features (uma por linha)</Label>
                                <textarea
                                    id="features"
                                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                                    placeholder="- Acesso total&#10;- Suporte 24/7&#10;- Certificados"
                                    value={formData.features}
                                    onChange={(e) => setFormData({ ...formData, features: e.target.value })}
                                />
                            </div>

                            <div className="flex items-center space-x-2 pt-2">
                                <Switch
                                    id="active"
                                    checked={formData.is_active}
                                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                                />
                                <Label htmlFor="active">Plano Ativo (Visível no site)</Label>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                            <Button onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Salvar
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Planos Cadastrados</CardTitle>
                    <CardDescription>
                        Lista de todos os planos de assinatura do sistema.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : plans.length === 0 ? (
                        <div className="text-center p-8 text-muted-foreground">
                            Nenhum plano cadastrado. Crie o primeiro!
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nome</TableHead>
                                    <TableHead>Preço</TableHead>
                                    <TableHead>Intervalo</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead>Stripe ID</TableHead>
                                    <TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {plans.map((plan) => (
                                    <TableRow key={plan.id}>
                                        <TableCell className="font-medium">
                                            <div>{plan.name}</div>
                                            <div className="text-xs text-muted-foreground">{plan.description}</div>
                                        </TableCell>
                                        <TableCell>
                                            R$ {plan.price.toFixed(2)}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">
                                                {plan.interval === 'monthly' ? 'Mensal' : 'Anual'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={plan.is_active ? 'default' : 'secondary'}>
                                                {plan.is_active ? 'Ativo' : 'Inativo'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-muted-foreground">
                                            {plan.stripe_price_id || '-'}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        setEditingPlan(plan)
                                                        setIsDialogOpen(true)
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={() => handleDelete(plan.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
