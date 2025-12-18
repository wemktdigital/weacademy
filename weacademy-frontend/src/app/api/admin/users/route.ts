import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { supabaseServer } from '@/lib/supabaseServer'

// GET: Listar todos os usuários (com paginação e filtro opcional)
export async function GET(request: Request) {
    const supabase = await supabaseServer()
    const { data: { session } } = await supabase.auth.getSession()

    // Verificar se é admin
    if (!session) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', session.user.id)
        .single()

    if (profile?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Buscar usuários do Auth (precisa do supabaseAdmin para listar users do auth)
    console.log('Fetching users from Supabase Auth...')
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000 // Limite alto para simplificar por enquanto
    })

    if (authError) {
        console.error('Error fetching auth users:', authError)
        return NextResponse.json({ error: 'Auth Error: ' + authError.message }, { status: 500 })
    }

    const users = authData.users
    console.log(`Found ${users.length} users in Auth.Fetching profiles...`)

    // Buscar perfis para obter os roles e nomes
    const { data: profiles, error: dbError } = await supabaseAdmin
        .from('profiles')
        .select('*')

    if (dbError) {
        console.error('Error fetching profiles:', dbError)
        return NextResponse.json({ error: 'DB Error: ' + dbError.message }, { status: 500 })
    }

    console.log(`Found ${profiles?.length} profiles.`)

    // Combinar dados (Auth + Profiles)
    const combinedUsers = users.map(authUser => {
        const profile = profiles?.find(p => p.id === authUser.id)
        return {
            id: authUser.id,
            email: authUser.email,
            full_name: profile?.full_name || authUser.user_metadata?.full_name || '',
            role: profile?.role || 'user',
            created_at: authUser.created_at,
            last_sign_in_at: authUser.last_sign_in_at
        }
    })

    return NextResponse.json(combinedUsers)
}

// POST: Criar novo usuário
export async function POST(request: Request) {
    try {
        const supabase = await supabaseServer()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', session.user.id)
            .single()

        if (adminProfile?.role !== 'admin') {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        const { email, password, full_name, role } = body

        if (!email || !password) {
            return NextResponse.json({ error: 'Email e senha são obrigatórios' }, { status: 400 })
        }

        // 1. Criar usuário no Auth
        const { data: authUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto confirmar
            user_metadata: { full_name }
        })

        if (createError) {
            console.error('Create User Error:', createError)
            return NextResponse.json({ error: createError.message }, { status: 400 })
        }

        // 2. Atualizar role no profile (o trigger handle_new_user já deve ter criado o profile)
        if (authUser.user) {
            // Forçar atualização do profile para garantir role e nome
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .upsert({
                    id: authUser.user.id,
                    email: email,
                    full_name: full_name,
                    role: role || 'user',
                    updated_at: new Date().toISOString()
                })

            if (profileError) {
                console.error('Profile Update Error:', profileError)
                return NextResponse.json({ error: 'User created but profile update failed: ' + profileError.message }, { status: 500 })
            }
        }

        // Log admin action
        try {
            await supabaseAdmin.from('admin_logs').insert({
                action: 'user_created',
                admin_id: session.user.id,
                target_user_id: authUser.user.id,
                details: { email, role, full_name }
            })
        } catch (logError) {
            console.error('Failed to log admin action:', logError)
            // Não falhar a request se o log falhar
        }

        return NextResponse.json({
            user: {
                id: authUser.user.id,
                email: authUser.user.email,
                full_name,
                role
            }
        })
    } catch (error: any) {
        console.error('Unhandled POST Error:', error)
        return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 })
    }
}
