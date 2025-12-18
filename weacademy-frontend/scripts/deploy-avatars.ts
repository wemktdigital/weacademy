import { Client } from 'pg'
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
            const value = match[2].trim().replace(/^["']|["']$/g, '')
            envConfig[key] = value
        }
    })

    const connectionString = envConfig['DATABASE_URL']
    if (!connectionString) {
        console.error('❌ DATABASE_URL not found in .env.local')
        process.exit(1)
    }

    console.log('🔌 Connecting to database...')
    const client = new Client({
        connectionString,
        ssl: { rejectUnauthorized: false } // Required for Supabase Cloud
    })

    try {
        await client.connect()
        console.log('✅ Connected to database')

        const migrationPath = path.join(process.cwd(), 'supabase/migrations/20251216000001_create_avatars_bucket.sql')
        const sql = fs.readFileSync(migrationPath, 'utf-8')

        console.log('⏳ Running migration...')
        await client.query(sql)

        console.log('✅ Migration applied successfully!')
    } catch (err: any) {
        console.error('❌ Migration failed:', err.message)
        process.exit(1)
    } finally {
        await client.end()
    }
}

main()
