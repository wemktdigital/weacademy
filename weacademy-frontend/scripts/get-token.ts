
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

async function main() {
    // 1. Load env vars manually
    const envPath = path.join(process.cwd(), '.env.local')
    if (!fs.existsSync(envPath)) {
        console.error('❌ .env.local not found')
        process.exit(1)
    }

    const envContent = fs.readFileSync(envPath, 'utf-8')
    const envConfig: Record<string, string> = {}

    envContent.split('\n').forEach(line => {
        const match = line.match(/^([^=]+)=(.*)$/)
        if (match) {
            const key = match[1].trim()
            const value = match[2].trim().replace(/^["']|["']$/g, '') // remove quotes
            envConfig[key] = value
        }
    })

    const supabaseUrl = envConfig['NEXT_PUBLIC_SUPABASE_URL']
    const supabaseKey = envConfig['NEXT_PUBLIC_SUPABASE_ANON_KEY']

    if (!supabaseUrl || !supabaseKey) {
        console.error('❌ Supabase URL or Key not found in .env.local')
        process.exit(1)
    }

    // 2. Create client
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 3. Login
    const { data, error } = await supabase.auth.signInWithPassword({
        email: 'admin@weacademy.com',
        password: 'admin123',
    })

    if (error) {
        console.error('❌ Login failed:', error.message)
        process.exit(1)
    }

    if (!data.session) {
        console.error('❌ No session returned')
        process.exit(1)
    }

    // 4. Output token
    console.log(data.session.access_token)
}

main()
