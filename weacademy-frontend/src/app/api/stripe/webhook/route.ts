import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { supabaseAdmin } from '@/lib/supabase-admin'
import Stripe from 'stripe'

export async function POST(req: Request) {
    const body = await req.text()
    const signature = (await headers()).get('Stripe-Signature') as string

    let event: Stripe.Event

    try {
        event = stripe.webhooks.constructEvent(
            body,
            signature,
            process.env.STRIPE_WEBHOOK_SECRET!
        )
    } catch (error: any) {
        console.error(`Webhook signature verification failed: ${error.message}`)
        return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
    }

    const session = event.data.object as Stripe.Checkout.Session
    const subscription = event.data.object as Stripe.Subscription

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                if (session.mode === 'subscription') {
                    const subscriptionId = session.subscription as string
                    const customerId = session.customer as string
                    const userId = session.metadata?.userId
                    const planId = session.metadata?.planId

                    if (!userId || !planId) {
                        console.error('Missing userId or planId in metadata')
                        break
                    }

                    // Retrieve subscription details to get dates
                    const subDetails = await stripe.subscriptions.retrieve(subscriptionId) as any

                    // Create subscription record
                    await supabaseAdmin.from('subscriptions').insert({
                        user_id: userId,
                        plan_id: planId,
                        stripe_subscription_id: subscriptionId,
                        status: subDetails.status,
                        current_period_start: new Date(subDetails.current_period_start * 1000).toISOString(),
                        current_period_end: new Date(subDetails.current_period_end * 1000).toISOString(),
                        cancel_at_period_end: subDetails.cancel_at_period_end
                    })

                    // Create invoice record if available
                    if (session.invoice) {
                        await supabaseAdmin.from('invoices').insert({
                            user_id: userId,
                            subscription_id: subscriptionId, // We might need to fetch internal ID, but for now let's skip relation or loose couple
                            amount: session.amount_total ? session.amount_total / 100 : 0,
                            status: 'paid',
                            stripe_invoice_id: session.invoice as string,
                            pdf_url: null // We don't have it yet, retrieved later or via invoice event
                        })
                    }
                }
                break
            }

            case 'customer.subscription.updated': {
                const sub = event.data.object as Stripe.Subscription

                // Find internal subscription by stripe_subscription_id
                const { error } = await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        status: sub.status,
                        current_period_start: new Date((sub as any).current_period_start * 1000).toISOString(),
                        current_period_end: new Date((sub as any).current_period_end * 1000).toISOString(),
                        cancel_at_period_end: sub.cancel_at_period_end
                    })
                    .eq('stripe_subscription_id', sub.id)

                if (error) console.error('Error updating subscription:', error)
                break
            }

            case 'customer.subscription.deleted': {
                const sub = event.data.object as Stripe.Subscription

                await supabaseAdmin
                    .from('subscriptions')
                    .update({
                        status: 'canceled',
                        cancel_at_period_end: false
                    })
                    .eq('stripe_subscription_id', sub.id)
                break
            }

            case 'invoice.payment_succeeded': {
                const invoice = event.data.object as Stripe.Invoice
                const subscriptionId = (invoice as any).subscription as string

                if (!subscriptionId) break // One-time payment

                // Find user from subscription
                const { data: subData } = await supabaseAdmin
                    .from('subscriptions')
                    .select('user_id')
                    .eq('stripe_subscription_id', subscriptionId)
                    .single()

                if (subData?.user_id) {
                    await supabaseAdmin.from('invoices').insert({
                        user_id: subData.user_id,
                        stripe_invoice_id: invoice.id,
                        amount: invoice.amount_paid / 100,
                        status: 'paid',
                        pdf_url: invoice.hosted_invoice_url,
                        created_at: new Date(invoice.created * 1000).toISOString()
                    })
                }
                break
            }
        }
    } catch (error: any) {
        console.error('Webhook handler failed:', error)
        return new NextResponse('Webhook handler failed', { status: 500 })
    }

    return new NextResponse(null, { status: 200 })
}
