import Stripe from 'stripe'

// Prevent crash during build/dev if key is missing, but API calls will fail (handled in route)
const stripeKey = process.env.STRIPE_SECRET_KEY || 'sk_test_placeholder'

export const stripe = new Stripe(stripeKey, {
    apiVersion: '2025-12-15.clover' as any,
    typescript: true,
})
