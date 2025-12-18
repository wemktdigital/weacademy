'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, Suspense } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Check, Shield, Zap, Star, Loader2 } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { useRouter, useSearchParams } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface Plan {
    id: string
    name: string
    description: string | null
    price: number
    interval: 'monthly' | 'yearly'
    stripe_price_id: string | null // Needed for checkout
    features: string[]
    is_active: boolean
    model_limits: Record<string, number>
}

function PricingContent() {
    const [plans, setPlans] = useState<Plan[]>([])
    const [loading, setLoading] = useState(true)
    const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly')
    const [processingId, setProcessingId] = useState<string | null>(null)
    const router = useRouter()
    const searchParams = useSearchParams()

    // Check auth status
    const [user, setUser] = useState<any>(null)

    useEffect(() => {
        const getUser = async () => {
            const { data } = await supabase.auth.getUser()
            setUser(data.user)
        }
        getUser()
        fetchPlans()
    }, [])

    useEffect(() => {
        // Auto Checkout Logic
        const autoCheckoutPlanId = searchParams.get('auto_checkout')
        if (user && autoCheckoutPlanId && plans.length > 0) {
            const plan = plans.find(p => p.id === autoCheckoutPlanId)
            if (plan) {
                // Remove param from URL to prevent loop
                window.history.replaceState({}, '', '/pricing')
                handleSubscribe(plan)
            }
        }
    }, [user, plans, searchParams])

    const handleSubscribe = async (plan: Plan) => {
        console.log('handleSubscribe called', { user, plan })

        if (!user) {
            console.log('User not logged in, redirecting to register')
            router.push(`/auth/register?plan=${plan.id}`)
            return
        }

        if (!plan.stripe_price_id) {
            console.log('Missing stripe_price_id')
            toast.error('Este plano não tem um preço configurado. Verifique no Admin.')
            return
        }

        try {
            toast.loading('Iniciando checkout...')
            console.log('Starting checkout fetch...')
            setProcessingId(plan.id)
            const response = await fetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    priceId: plan.stripe_price_id,
                    planId: plan.id
                })
            })

            console.log('Fetch response status:', response.status)

            if (!response.ok) {
                const errorData = await response.json()
                console.error('Checkout API Error:', errorData)
                throw new Error(errorData.error || 'Falha ao iniciar checkout')
            }

            const { url } = await response.json()
            console.log('Redirecting to:', url)
            window.location.href = url
        } catch (error) {
            console.error('Catch Error:', error)
            toast.dismiss()
            toast.error('Erro ao conectar com o pagamento.')
        } finally {
            setProcessingId(null)
        }
    }

    const fetchPlans = async () => {
        try {
            setLoading(true)
            const { data, error } = await supabase
                .from('plans')
                .select('*')
                .eq('is_active', true)
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

    const filteredPlans = plans.filter(p => p.interval === billingInterval)

    return (
        <div className="min-h-screen bg-background text-foreground">
            {/* Header Section */}
            <div className="relative overflow-hidden pt-16 pb-12 text-center md:pt-24 md:pb-16">
                <div className="container relative mx-auto px-4 z-10">
                    <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                        Escolha seu Plano
                    </h1>
                    <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
                        Desbloqueie todo o potencial da IA e acelere seu aprendizado com nossos planos exclusivos.
                    </p>

                    {/* Billing Toggle */}
                    <div className="mt-8 flex justify-center items-center gap-4">
                        <span className={`text-sm font-medium ${billingInterval === 'monthly' ? 'text-foreground' : 'text-muted-foreground'}`}>Mensal</span>
                        <div
                            className="relative h-8 w-14 rounded-full bg-muted p-1 cursor-pointer transition-colors hover:bg-muted/80"
                            onClick={() => setBillingInterval(prev => prev === 'monthly' ? 'yearly' : 'monthly')}
                        >
                            <div className={`absolute h-6 w-6 rounded-full bg-background shadow-sm transition-transform duration-200 ${billingInterval === 'yearly' ? 'translate-x-6' : 'translate-x-0'}`} />
                        </div>
                        <span className={`text-sm font-medium ${billingInterval === 'yearly' ? 'text-foreground' : 'text-muted-foreground'}`}>Anual (2 meses grátis)</span>
                    </div>
                </div>
            </div>

            {/* Plans Grid */}
            <div className="container mx-auto px-4 pb-24">
                {loading ? (
                    <div className="flex justify-center items-center h-64">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-7xl mx-auto">
                        {filteredPlans.map((plan) => (
                            <Card key={plan.id} className="flex flex-col relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
                                {/* Popular Badge logic could be added here */}
                                {plan.description?.toLowerCase().includes('popular') && (
                                    <div className="absolute top-0 right-0">
                                        <div className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-bl-lg">
                                            MAIS POPULAR
                                        </div>
                                    </div>
                                )}

                                <CardHeader>
                                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                                    <CardDescription className="text-base mt-2 min-h-[50px]">
                                        {plan.description}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="flex-1">
                                    <div className="mb-6">
                                        <div className="flex items-baseline md:flex-col lg:flex-row gap-1">
                                            <span className="text-4xl font-bold">R$ {plan.price.toFixed(2)}</span>
                                            <span className="text-muted-foreground">/{plan.interval === 'monthly' ? 'mês' : 'ano'}</span>
                                        </div>
                                        {/* Cost savings for yearly could be calculated here */}
                                    </div>

                                    <div className="space-y-4">
                                        {/* Features List */}
                                        <div className="space-y-2">
                                            {plan.features.map((feature, i) => (
                                                <div key={i} className="flex items-start gap-2 text-sm">
                                                    <Check className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                                                    <span>{feature}</span>
                                                </div>
                                            ))}
                                        </div>

                                        {/* AI Limits Preview */}
                                        {Object.keys(plan.model_limits || {}).length > 0 && (
                                            <div className="pt-4 border-t">
                                                <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">Limites de IA</p>
                                                <div className="space-y-2">
                                                    {Object.entries(plan.model_limits).slice(0, 3).map(([model, limit]) => (
                                                        <div key={model} className="flex justify-between text-sm">
                                                            <span className="text-muted-foreground capitalize">{model.replace('gpt-', 'GPT ').replace('claude-', 'Claude ')}</span>
                                                            <Badge variant="secondary" className="text-xs">
                                                                {limit === -1 ? 'Ilimitado' : `${limit}/mês`}
                                                            </Badge>
                                                        </div>
                                                    ))}
                                                    {Object.keys(plan.model_limits).length > 3 && (
                                                        <p className="text-xs text-muted-foreground">+ outros modelos incluídos</p>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        className="w-full"
                                        size="lg"
                                        onClick={() => handleSubscribe(plan)}
                                        disabled={!!processingId}
                                    >
                                        {processingId === plan.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        {user ? 'Assinar Agora' : 'Criar Conta e Assinar'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function PricingPage() {
    return (
        <Suspense fallback={<div className="flex justify-center items-center h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
            <PricingContent />
        </Suspense>
    )
}
