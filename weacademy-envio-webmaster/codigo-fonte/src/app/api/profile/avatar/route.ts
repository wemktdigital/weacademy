import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseServer } from '@/lib/supabaseServer'

export const dynamic = "force-dynamic"

async function authenticateUser(request: NextRequest) {
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
    
    const { data: { user: tokenUser }, error: tokenError } = await supabaseWithToken.auth.getUser(token)
    if (!tokenError && tokenUser) {
      user = tokenUser
    }
  }
  
  if (!user) {
    const sb = await supabaseServer()
    const { data: { user: cookieUser }, error: authErr } = await sb.auth.getUser()
    if (!authErr && cookieUser) {
      user = cookieUser
    }
  }

  return user
}

// POST /api/profile/avatar - Upload e atualizar avatar
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Obter arquivo do FormData
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })
    }

    // Validar tipo de arquivo
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Por favor, selecione uma imagem válida' }, { status: 400 })
    }

    // Validar tamanho (max 5MB)
    const maxSize = 5 * 1024 * 1024 // 5MB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'A imagem deve ter menos de 5MB' }, { status: 400 })
    }

    // Criar cliente com service role para contornar RLS
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Converter arquivo para buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Gerar nome único para o arquivo
    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Date.now()}.${fileExt}`
    const filePath = `avatars/${fileName}`

    // Deletar avatar anterior se existir (opcional, para limpar storage)
    const { data: existingProfile } = await serviceRoleSupabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    if (existingProfile?.avatar_url) {
      // Tentar extrair e remover arquivo antigo
      // O formato da URL é: http://.../storage/v1/object/public/avatars/path/to/file
      try {
        // Extrair o caminho após '/avatars/' na URL
        const urlParts = existingProfile.avatar_url.split('/avatars/')
        if (urlParts.length > 1) {
          const oldPath = urlParts[1].split('?')[0] // Remove query params se houver
          if (oldPath) {
            await serviceRoleSupabase.storage
              .from('avatars')
              .remove([oldPath])
          }
        }
      } catch (error) {
        // Ignorar erros ao remover arquivo antigo (pode não existir)
        console.warn('Could not remove old avatar:', error)
      }
    }

    // Upload para Supabase Storage
    const { data: uploadData, error: uploadError } = await serviceRoleSupabase
      .storage
      .from('avatars')
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      })

    if (uploadError) {
      console.error('Error uploading avatar:', uploadError)
      return NextResponse.json({ 
        error: uploadError.message || 'Erro ao fazer upload da imagem' 
      }, { status: 400 })
    }

    // Obter URL pública
    const { data: publicUrlData } = serviceRoleSupabase
      .storage
      .from('avatars')
      .getPublicUrl(filePath)

    // Atualizar perfil usando service role (contorna RLS)
    const { error: updateError } = await serviceRoleSupabase
      .from('profiles')
      .update({ avatar_url: publicUrlData.publicUrl })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      // Se falhar ao atualizar, remover o arquivo que acabou de fazer upload
      await serviceRoleSupabase.storage
        .from('avatars')
        .remove([filePath])
      
      return NextResponse.json({ 
        error: updateError.message || 'Erro ao atualizar perfil' 
      }, { status: 400 })
    }

    return NextResponse.json({
      url: publicUrlData.publicUrl,
      path: uploadData.path,
    })
  } catch (error: any) {
    console.error('Error in POST /api/profile/avatar:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao fazer upload da imagem' },
      { status: 500 }
    )
  }
}

// DELETE /api/profile/avatar - Remover avatar
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateUser(request)
    
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Criar cliente com service role para contornar RLS
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Buscar avatar atual
    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Perfil não encontrado' }, { status: 404 })
    }

    // Remover arquivo do storage se existir
    if (profile.avatar_url) {
      try {
        // Extrair caminho do avatar da URL
        // O formato da URL é: http://.../storage/v1/object/public/avatars/path/to/file
        const urlParts = profile.avatar_url.split('/avatars/')
        if (urlParts.length > 1) {
          const oldPath = urlParts[1].split('?')[0] // Remove query params se houver
          if (oldPath) {
            await serviceRoleSupabase.storage
              .from('avatars')
              .remove([oldPath])
          }
        }
      } catch (error) {
        // Ignorar erros ao remover arquivo (pode não existir)
        console.warn('Could not remove avatar file:', error)
      }
    }

    // Atualizar perfil para remover avatar_url
    const { error: updateError } = await serviceRoleSupabase
      .from('profiles')
      .update({ avatar_url: null })
      .eq('id', user.id)

    if (updateError) {
      console.error('Error removing avatar:', updateError)
      return NextResponse.json({ 
        error: updateError.message || 'Erro ao remover foto' 
      }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error in DELETE /api/profile/avatar:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao remover foto' },
      { status: 500 }
    )
  }
}

