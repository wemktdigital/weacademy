import { supabase } from '@/lib/supabase'

export const trackEvent = async (
    eventName: string,
    metadata: Record<string, any> = {}
) => {
    try {
        const { error } = await supabase.rpc('track_event', {
            event_name: eventName,
            event_metadata: metadata,
            page_url: typeof window !== 'undefined' ? window.location.pathname : null,
            user_agent: typeof window !== 'undefined' ? window.navigator.userAgent : null
        })

        if (error) {
            console.error('Error tracking event:', error)
        }
    } catch (err) {
        console.error('Exception tracking event:', err)
    }
}
