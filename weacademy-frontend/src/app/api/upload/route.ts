import { NextRequest, NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticação
    let user = null
    
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        }
      )
      
      const { data: { user: tokenUser } } = await supabaseWithToken.auth.getUser(token)
      if (tokenUser) user = tokenUser
    }
    
    if (!user) {
      const sb = await supabaseServer()
      const { data: { user: cookieUser } } = await sb.auth.getUser()
      if (cookieUser) user = cookieUser
    }

    if (!user) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 })
    }

    // Verificar role
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'gestor_we', 'instructor'].includes(profile?.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Obter arquivo do FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Tipo de arquivo não permitido' }, { status: 400 })
    }

    // Validar tamanho (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5MB' }, { status: 400 })
    }

    // Converter arquivo para buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop()
    const fileName = `${timestamp}-${randomStr}.${fileExt}`

    // Upload para Supabase Storage
    const { data, error } = await serviceRoleSupabase
      .storage
      .from('course-thumbnails')
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error("[LABAUTH][UPLOAD][ERROR]", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Obter URL pública
    const { data: publicUrlData } = serviceRoleSupabase
      .storage
      .from('course-thumbnails')
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: data.path,
    })
  } catch (error: any) {
    console.error("[LABAUTH][UPLOAD][ERROR]", error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload' },
      { status: 400 }
    )
  }
}

