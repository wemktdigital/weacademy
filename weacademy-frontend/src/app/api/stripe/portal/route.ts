import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createClient } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: Request) {
    try {
        // 1. Validate User
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Get Customer ID
        // Strategy: 
        // A. Check if we have a subscription locally with stripe check
        // B. Search Stripe by email

        let customerId: string | undefined

        // Try getting from active subscription first (most reliable)
        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_subscription_id')
            .eq('user_id', user.id)
            .in('status', ['active', 'trialing'])
            .single()

        if (subscription?.stripe_subscription_id) {
            try {
                const stripeSub = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id)
                customerId = stripeSub.customer as string
            } catch (e) {
                console.warn('Error retrieving stripe subscription:', e)
            }
        }

        // Fallback: Search by email
        if (!customerId) {
            const customers = await stripe.customers.list({
                email: user.email,
                limit: 1
            })
            if (customers.data.length > 0) {
                customerId = customers.data[0].id
            }
        }

        if (!customerId) {
            return NextResponse.json(
                { error: 'Não foi possível encontrar sua conta de cobrança.' },
                { status: 404 }
            )
        }

        // 3. Create Portal Session
        const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

        const session = await stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${ORIGIN}/my-courses`,
            configuration: 'bpc_1SfmTcLX5xYfi68Vxl91NDui', // ID fornecido pelo usuário
        })

        return NextResponse.json({ url: session.url })

    } catch (error: any) {
        console.error('[STRIPE_PORTAL]', error)
        return NextResponse.json(
            { error: error.message || 'Internal Error' },
            { status: 500 }
        )
    }
}
