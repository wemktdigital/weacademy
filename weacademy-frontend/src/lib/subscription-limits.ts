import { supabaseAdmin } from './supabase-admin'

interface UsageCheckResult {
    allowed: boolean
    reason?: 'no_subscription' | 'plan_inactive' | 'model_not_allowed' | 'limit_exceeded' | 'error'
    limit?: number
    currentUsage?: number
    planName?: string
}

export async function checkUsageLimit(userId: string, model: string): Promise<UsageCheckResult> {
    try {
        // 0. God Mode: Check if user is Admin
        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', userId)
            .single()

        if (profile?.role === 'admin') {
            return { allowed: true, limit: -1, planName: 'Admin (Ilimitado)' }
        }

        // 1. Get Active Subscription and Plan
        const { data: subscription, error: subError } = await supabaseAdmin
            .from('subscriptions')
            .select(`
                id,
                status,
                current_period_start,
                current_period_end,
                plan:plans (
                    id,
                    name,
                    is_active,
                    model_limits
                )
            `)
            .eq('user_id', userId)
            .in('status', ['active', 'trialing'])
            .single()

        if (subError || !subscription) {
            // Check if user is admin/superuser? skipping for now, assume strict check
            return { allowed: false, reason: 'no_subscription' }
        }

        const plan = subscription.plan as any
        if (!plan || !plan.is_active) {
            return { allowed: false, reason: 'plan_inactive', planName: plan?.name }
        }

        // 2. Check Model Limits
        // model_limits is JSONB, e.g. { "gpt-5-nano": 100, "gpt-4": 10 } or { "gpt-5-nano": -1 }
        const limits = plan.model_limits || {}

        console.log('[UsageCheck] Plan:', plan.name)
        console.log('[UsageCheck] Limits:', JSON.stringify(limits))
        console.log('[UsageCheck] Requested Model:', model)

        let limit = limits[model]

        // If undefined, maybe check if there's a wildcard or "all"?
        // Current implementation: strict exact match required in plan config.
        if (limit === undefined) {
            // Try fallback to model family? e.g. "gpt-4-turbo" falls back to "gpt-4"
            // For simplicity, strict return.
            return { allowed: false, reason: 'model_not_allowed', planName: plan.name }
        }

        if (limit === -1) {
            return { allowed: true, limit: -1, planName: plan.name }
        }

        // 3. Count Usage in Current Period
        const { count, error: countError } = await supabaseAdmin
            .from('subscription_usage')
            .select('*', { count: 'exact', head: true })
            .eq('subscription_id', subscription.id)
            .eq('feature_name', model)
            .gte('period_start', subscription.current_period_start)
            .lte('period_end', subscription.current_period_end)

        if (countError) {
            console.error('Error counting usage:', countError)
            return { allowed: false, reason: 'error' }
        }

        const currentUsage = count || 0

        if (currentUsage >= limit) {
            return {
                allowed: false,
                reason: 'limit_exceeded',
                limit,
                currentUsage,
                planName: plan.name
            }
        }

        return {
            allowed: true,
            limit,
            currentUsage,
            planName: plan.name
        }

    } catch (error) {
        console.error('checkUsageLimit Exception:', error)
        return { allowed: false, reason: 'error' }
    }
}

export async function incrementUsage(userId: string, model: string) {
    try {
        // We need the subscription ID again. 
        // Optimization: fetch it once and pass it? For now, re-fetch safe.
        const { data: subscription } = await supabaseAdmin
            .from('subscriptions')
            .select('id, current_period_start, current_period_end')
            .eq('user_id', userId)
            .in('status', ['active', 'trialing'])
            .single()

        if (!subscription) return

        await supabaseAdmin.from('subscription_usage').insert({
            subscription_id: subscription.id,
            user_id: userId,
            feature_name: model,
            period_start: subscription.current_period_start,
            period_end: subscription.current_period_end,
            usage_count: 1 // We log individual events, so count is 1 per row. 
            // NOTE: The schema had usage_count, suggesting aggregation? 
            // logic above uses count(*) of rows. 
            // If we want aggregation, we would update a row.
            // Let's stick to "1 row per request" for detailed audit logs unless scale is huge.
            // If schema intended aggregation: "usage_count defaults to 0".
            // Let's do 1 row per request for better analytics (timestamp_usage).
        })

    } catch (error) {
        console.error('Error incrementing usage:', error)
    }
}
