import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // 1. Security Check
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Check if Admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        // 2. Fetch Data Parallel
        const [
            { data: activeSubs },
            { data: canceledSubs },
            { data: allProfiles },
            { data: aiUsage },
            { data: invoices }
        ] = await Promise.all([
            // Active Subscriptions (for MRR)
            supabaseAdmin
                .from('subscriptions')
                .select('plan:plans(price, name)')
                .in('status', ['active', 'trialing']),

            // Canceled Subscriptions (for Churn)
            supabaseAdmin
                .from('subscriptions')
                .select('created_at, updated_at')
                .eq('status', 'canceled'),

            // Profiles (for User Growth)
            supabaseAdmin
                .from('profiles')
                .select('created_at'),

            // AI Usage
            supabaseAdmin
                .from('subscription_usage')
                .select('feature_name, usage_count, created_at'),

            // Invoices (for Revenue History)
            supabaseAdmin
                .from('invoices')
                .select('amount, created_at, status')
                .eq('status', 'paid')
        ])

        // 3. Process MRR
        let mrr = 0
        activeSubs?.forEach((sub: any) => {
            if (sub.plan?.price) {
                mrr += Number(sub.plan.price)
            }
        })

        // 4. Process Revenue History (Last 6 months)
        const revenueByMonth: Record<string, number> = {}
        const sixMonthsAgo = new Date()
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)

        // Initialize last 6 months
        for (let i = 0; i < 6; i++) {
            const d = new Date()
            d.setMonth(d.getMonth() - i)
            const key = d.toISOString().slice(0, 7) // YYYY-MM
            revenueByMonth[key] = 0
        }

        invoices?.forEach((inv) => {
            const key = inv.created_at.slice(0, 7)
            if (revenueByMonth[key] !== undefined) {
                revenueByMonth[key] += Number(inv.amount)
            }
        })

        const revenueChart = Object.entries(revenueByMonth)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, amount]) => ({
                date,
                amount
            }))

        // 5. Process User Growth (Simulated cumulative)
        const usersByMonth: Record<string, number> = {}
        allProfiles?.forEach((p) => {
            const key = p.created_at.slice(0, 7)
            usersByMonth[key] = (usersByMonth[key] || 0) + 1
        })

        // 6. Process AI Usage
        const usageByModel: Record<string, number> = {}
        aiUsage?.forEach((u) => {
            usageByModel[u.feature_name] = (usageByModel[u.feature_name] || 0) + u.usage_count
        })

        const aiUsageChart = Object.entries(usageByModel).map(([name, value]) => ({
            name,
            value
        }))

        // 7. Stats
        const totalUsers = allProfiles?.length || 0
        const activeSubscribers = activeSubs?.length || 0
        const churnRate = (activeSubscribers > 0)
            ? ((canceledSubs?.length || 0) / activeSubscribers) * 100
            : 0

        return NextResponse.json({
            mrr,
            totalUsers,
            activeSubscribers,
            churnRate,
            revenueChart,
            aiUsageChart
        })

    } catch (error: any) {
        console.error('[ANALYTICS]', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
