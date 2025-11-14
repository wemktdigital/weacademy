import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = 'force-dynamic'

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
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Obter arquivo do FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo (imagens, vídeos, áudio)
    const allowedTypes = [
      // Imagens
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/webp',
      // Vídeos
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/webm',
      // Áudio
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
    ]
    
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido: ${file.type}` },
        { status: 400 }
      )
    }

    // Validar tamanho (max 50MB para vídeos, 10MB para outros)
    const maxSize = file.type.startsWith('video/') ? 50 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo: ${maxSize / (1024 * 1024)}MB` },
        { status: 400 }
      )
    }

    // Converter arquivo para buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileExt = file.name.split('.').pop() || 'bin'
    const fileName = `${timestamp}-${randomStr}.${fileExt}`

    // Determinar bucket baseado no tipo
    const bucket = file.type.startsWith('image/') 
      ? 'lab-chat-images'
      : file.type.startsWith('video/')
      ? 'lab-chat-videos'
      : 'lab-chat-audio'

    // Upload para Supabase Storage
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Criar bucket se não existir (apenas para desenvolvimento)
    const { data: buckets } = await serviceRoleSupabase.storage.listBuckets()
    if (!buckets?.find(b => b.name === bucket)) {
      await serviceRoleSupabase.storage.createBucket(bucket, {
        public: true,
        fileSizeLimit: maxSize,
        allowedMimeTypes: allowedTypes.filter(t => 
          t.startsWith(bucket.split('-')[2].slice(0, -1)) // 'images' -> 'image'
        ),
      })
    }

    const { data, error } = await serviceRoleSupabase
      .storage
      .from(bucket)
      .upload(fileName, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (error) {
      console.error('[LAB-IA][UPLOAD][ERROR]', error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Obter URL pública
    const { data: publicUrlData } = serviceRoleSupabase
      .storage
      .from(bucket)
      .getPublicUrl(fileName)

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: data.path,
      type: file.type,
      size: file.size,
      name: file.name,
    })
  } catch (error: any) {
    console.error('[LAB-IA][UPLOAD][ERROR]', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload' },
      { status: 400 }
    )
  }
}

