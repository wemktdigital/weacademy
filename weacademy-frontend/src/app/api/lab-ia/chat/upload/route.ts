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

    // Validar tipo de arquivo (imagens, vídeos, áudio, documentos)
    const allowedTypes = [
      // Imagens
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/bmp',
      'image/svg+xml',
      // Vídeos
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/webm',
      'video/x-msvideo', // .avi
      // Áudio
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/webm',
      'audio/ogg',
      'audio/aac',
      'audio/flac',
      // Documentos
      'application/pdf',
      'application/msword', // .doc
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
      'application/vnd.ms-excel', // .xls
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-powerpoint', // .ppt
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // .pptx
      'text/plain', // .txt
      'text/csv', // .csv
      'application/rtf', // .rtf
    ]
    
    // Verificar por tipo MIME ou extensão de arquivo
    const isValidType = allowedTypes.includes(file.type) || 
      file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf|jpg|jpeg|png|gif|webp|bmp|svg|mp4|mpg|mpeg|mov|webm|avi|mp3|wav|ogg|aac|flac)$/i)
    
    if (!isValidType) {
      return NextResponse.json(
        { error: `Tipo de arquivo não permitido: ${file.type || file.name}. Tipos permitidos: imagens, PDFs, documentos Word/Excel/PowerPoint, áudios e vídeos.` },
        { status: 400 }
      )
    }

    // Validar tamanho (max 50MB para todos os arquivos)
    const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `Arquivo muito grande. Máximo: 50 MB. Tamanho atual: ${(file.size / (1024 * 1024)).toFixed(2)} MB` },
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
    let bucket = 'lab-chat-documents' // Padrão para documentos
    
    if (file.type.startsWith('image/')) {
      bucket = 'lab-chat-images'
    } else if (file.type.startsWith('video/')) {
      bucket = 'lab-chat-videos'
    } else if (file.type.startsWith('audio/')) {
      bucket = 'lab-chat-audio'
    } else if (
      file.type.includes('pdf') ||
      file.type.includes('word') ||
      file.type.includes('excel') ||
      file.type.includes('powerpoint') ||
      file.type.includes('spreadsheet') ||
      file.type.includes('presentation') ||
      file.type === 'text/plain' ||
      file.type === 'text/csv' ||
      file.type === 'application/rtf' ||
      file.name.match(/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|rtf)$/i)
    ) {
      bucket = 'lab-chat-documents'
    }

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
        fileSizeLimit: MAX_FILE_SIZE,
        allowedMimeTypes: bucket === 'lab-chat-documents' 
          ? allowedTypes.filter(t => 
              t.includes('pdf') || 
              t.includes('word') || 
              t.includes('excel') || 
              t.includes('powerpoint') || 
              t.includes('spreadsheet') || 
              t.includes('presentation') ||
              t === 'text/plain' ||
              t === 'text/csv' ||
              t === 'application/rtf'
            )
          : allowedTypes.filter(t => 
              t.startsWith(bucket.split('-')[2].slice(0, -1)) // 'images' -> 'image', 'videos' -> 'video', 'audio' -> 'audio'
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

