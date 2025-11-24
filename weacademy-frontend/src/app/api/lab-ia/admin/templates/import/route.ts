import { NextResponse } from 'next/server'
import { supabaseServer } from '@/lib/supabaseServer'
import { createClient } from '@supabase/supabase-js'
import { agentSchema } from '@/lib/validations/agent.schema'

export async function POST(request: Request) {
  try {
    // Tentar autenticar via Authorization header
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    
    let user: any = null
    let authError: any = null

    if (token) {
      const supabaseWithToken = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      )
      const { data, error } = await supabaseWithToken.auth.getUser(token)
      if (!error && data?.user) {
        user = data.user
      } else {
        authError = error
      }
    }

    // Fallback: autenticar via cookies (sessão do usuário)
    if (!user) {
      const supabase = await supabaseServer()
      const { data, error } = await supabase.auth.getUser()
      user = data?.user || null
      authError = error
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized', details: authError?.message },
        { status: 401 }
      )
    }

    // Verificar role com service role (bypass RLS)
    const serviceRoleSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    const { data: profile } = await serviceRoleSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      )
    }

    // Parse do body
    const body = await request.json()
    const { templates } = body

    if (!templates || !Array.isArray(templates)) {
      return NextResponse.json(
        { error: 'Invalid format: templates must be an array' },
        { status: 400 }
      )
    }

    // Validar e importar cada template
    const results = []
    for (const template of templates) {
      try {
        // Validar usando schema
        const validatedData = agentSchema.parse(template)
        
        // Remover campos que não existem na tabela lab_agent_templates
        // (active, knowledge_base_files existem apenas em lab_agents)
        const templateData = {
          name: validatedData.name,
          description: validatedData.description,
          icon: validatedData.icon,
          category: validatedData.category,
          provider: validatedData.provider,
          model: validatedData.model,
          prompt: validatedData.prompt,
          type: validatedData.type,
        }
        
        // Inserir no banco usando service role (bypass RLS após validar role)
        const { data, error } = await serviceRoleSupabase
          .from('lab_agent_templates')
          .insert(templateData)
          .select()
          .single()

        if (error) {
          results.push({
            name: template.name,
            success: false,
            error: error.message,
          })
        } else {
          results.push({
            name: template.name,
            success: true,
            id: data.id,
          })
        }
      } catch (error: any) {
        results.push({
          name: template.name,
          success: false,
          error: error.message || 'Validation error',
        })
      }
    }

    const successCount = results.filter(r => r.success).length

    return NextResponse.json({
      message: `Imported ${successCount} of ${templates.length} templates`,
      results,
    })
  } catch (error) {
    console.error('Error importing templates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
