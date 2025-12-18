import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { supabaseServer } from '@/lib/supabaseServer'

// PATCH: Atualizar usuário
export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: userId } = await params
    const body = await request.json()
    const { full_name, role, password, email } = body

    const updates: any = {}
    const authUpdates: any = {}

    // Preparar updates
    if (full_name !== undefined) updates.full_name = full_name
    if (role !== undefined) updates.role = role

    if (email !== undefined) {
        updates.email = email
        authUpdates.email = email
    }
    if (password) {
        authUpdates.password = password
    }
    if (full_name) {
        authUpdates.user_metadata = { full_name }
    }

    try {
        // 1. Atualizar Auth se necessário (senha, email)
        if (Object.keys(authUpdates).length > 0) {
            const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
                userId,
                authUpdates
            )
            if (authError) throw authError
        }

        // 2. Atualizar Profile
        if (Object.keys(updates).length > 0) {
            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', userId)

            if (profileError) throw profileError
        }

        // Log admin action
        await supabaseAdmin.from('admin_logs').insert({
            action: 'user_updated',
            admin_id: session.user.id,
            target_user_id: userId,
            details: { updates, authUpdates }
        })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

// DELETE: Deletar usuário
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: userId } = await params

    try {
        // 1. Deletar do Auth (O Cascade deve deletar o profile, mas vamos garantir)
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) throw deleteError

        // Log admin action
        await supabaseAdmin.from('admin_logs').insert({
            action: 'user_deleted',
            admin_id: session.user.id,
            target_user_id: userId, // Pode não ser foreign key válida se o user sumiu, mas o campo target_user_id deve ser UUID nullable ou texto
            details: { deleted_at: new Date().toISOString() }
        })

        return NextResponse.json({ success: true })

    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
