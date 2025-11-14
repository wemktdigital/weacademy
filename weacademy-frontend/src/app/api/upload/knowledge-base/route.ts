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

    // Verificar role (admin ou gestor_we podem fazer upload)
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!['admin', 'gestor_we'].includes(profile?.role)) {
      return NextResponse.json({ error: 'Sem permissão' }, { status: 403 })
    }

    // Obter arquivo do FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo (permitir PDF, TXT, DOCX, MD)
    const allowedTypes = [
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/markdown',
    ]
    const allowedExtensions = ['.pdf', '.txt', '.docx', '.md']
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExt)) {
      return NextResponse.json(
        { error: 'Tipo de arquivo não permitido. Use PDF, TXT, DOCX ou MD.' },
        { status: 400 }
      )
    }

    // Validar tamanho (max 100MB para knowledge base)
    const maxSize = 100 * 1024 * 1024 // 100MB
    if (file.size > maxSize) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2)
      return NextResponse.json(
        { 
          error: `Arquivo muito grande. O arquivo tem ${fileSizeMB}MB, mas o limite máximo é 100MB.` 
        }, 
        { status: 400 }
      )
    }

    // Converter arquivo para buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Gerar nome único para o arquivo
    const timestamp = Date.now()
    const randomStr = Math.random().toString(36).substring(2, 15)
    const fileName = `knowledge-base/${timestamp}-${randomStr}${fileExt}`

    // Upload para Supabase Storage (criar bucket se não existir)
    // Por enquanto, usar um bucket genérico ou criar um específico
    const bucketName = 'knowledge-base'
    
    // Verificar se o bucket existe, se não, criar
    const { data: buckets } = await serviceRoleSupabase.storage.listBuckets()
    const bucketExists = buckets?.some((b) => b.name === bucketName)
    
    if (!bucketExists) {
      // Criar bucket (requer permissões adequadas)
      await serviceRoleSupabase.storage.createBucket(bucketName, {
        public: false, // Arquivos privados por padrão
      })
    }

    const { data, error } = await serviceRoleSupabase
      .storage
      .from(bucketName)
      .upload(fileName, buffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      })

    if (error) {
      console.error("[UPLOAD][KNOWLEDGE-BASE][ERROR]", error)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Obter URL assinada (já que o bucket é privado)
    const { data: signedUrlData, error: signedUrlError } = await serviceRoleSupabase
      .storage
      .from(bucketName)
      .createSignedUrl(fileName, 31536000) // URL válida por 1 ano

    if (signedUrlError) {
      console.error("[UPLOAD][KNOWLEDGE-BASE][SIGNED-URL-ERROR]", signedUrlError)
      // Retornar path mesmo assim, o frontend pode usar diretamente
      return NextResponse.json({
        url: `${bucketName}/${fileName}`,
        path: data.path,
      })
    }

    return NextResponse.json({
      url: signedUrlData.signedUrl,
      path: data.path,
    })
  } catch (error: any) {
    console.error("[UPLOAD][KNOWLEDGE-BASE][ERROR]", error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload' },
      { status: 400 }
    )
  }
}

