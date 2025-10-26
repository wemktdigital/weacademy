import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'
import { agentSchema } from '@/lib/validations/agent.schema'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    
    // Verificar autenticação
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || !['admin', 'gestor_we'].includes(profile.role)) {
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
        
        // Inserir no banco
        const { data, error } = await supabase
          .from('lab_agent_templates')
          .insert(validatedData)
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
