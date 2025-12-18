import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server' // Use server client

export async function POST(req: Request) {
    try {
        // 1. Validate User
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            console.error('Checkout API: Unauthorized (No User Found)')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        const { priceId, planId } = body

        if (!priceId || !planId) {
            return new NextResponse('Missing priceId or planId', { status: 400 })
        }

        // 2. Create or Get Stripe Customer
        // Check if user already has a stripe_customer_id in subscriptions or profiles
        // Ideally we store this in `subscriptions` or a specific mapping table. 
        // For now, let's assume we search by email or create new.

        let customerId: string | undefined

        const { data: existingSub } = await supabaseAdmin
            .from('subscriptions')
            .select('stripe_subscription_id') // We might not have customer_id here easily if we didn't add it.
            // Let's rely on email search for now if we don't have a direct link table
            .eq('user_id', user.id)
            .single()

        // Better: Search Stripe by email
        const customers = await stripe.customers.list({
            email: user.email,
            limit: 1
        })

        if (customers.data.length > 0) {
            customerId = customers.data[0].id
        } else {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.user_metadata?.full_name,
                metadata: {
                    userId: user.id
                }
            })
            customerId = customer.id
        }

        // 3. Create Checkout Session
        const ORIGIN = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'

        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${ORIGIN}/my-courses?success=true`,
            cancel_url: `${ORIGIN}/pricing?canceled=true`,
            metadata: {
                userId: user.id,
                planId: planId
            },
            subscription_data: {
                metadata: {
                    userId: user.id,
                    planId: planId
                }
            }
        })

        return NextResponse.json({ url: session.url })

    } catch (error: any) {
        console.error('[STRIPE_CHECKOUT]', error)
        return NextResponse.json(
            { error: error.message || 'Internal Error' },
            { status: 500 }
        )
    }
}
