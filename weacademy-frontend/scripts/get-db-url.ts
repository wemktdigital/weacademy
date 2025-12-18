
import * as fs from 'fs'
import * as path from 'path'

async function main() {
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

    console.log(envConfig['DATABASE_URL'])
}

main()
